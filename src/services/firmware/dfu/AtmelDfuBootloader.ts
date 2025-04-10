import {
  FirmwareWriterPhaseListener,
  FirmwareWriterProgressListener,
} from '../FirmwareWriter';
import { AbstractDfuBootloader } from './AbstractDfuBootloader';
import { DFU_STATUS, IUsb, UINT32_MAX, UINT8_MAX, USB_STATE } from '../usb/Usb';
import { IDfuTargetMapping } from './DfuBootloader';
import {
  errorResultOf,
  IEmptyResult,
  IResult,
  isError,
  successResult,
  successResultOf,
} from '../../../types';

export const ATMEL_64KB_PAGE = 0x10000;
export const ATMEL_MAX_TRANSFER_SIZE = 0x0400;
export const ATMEL_CONTROL_BLOCK_SIZE = 32;
export const ATMEL_AVR32_CONTROL_BLOCK_SIZE = 64;
export const ATMEL_FOOTER_SIZE = 16;
export const ATMEL_MAX_FLASH_BUFFER_SIZE =
  ATMEL_MAX_TRANSFER_SIZE +
  ATMEL_AVR32_CONTROL_BLOCK_SIZE +
  ATMEL_AVR32_CONTROL_BLOCK_SIZE +
  ATMEL_FOOTER_SIZE;
export const ALL_ATMEL_ERASE_MODE = [
  'block0',
  'block1',
  'block2',
  'block3',
  'all',
] as const;
type atmelEraseModeTuple = typeof ALL_ATMEL_ERASE_MODE;
export type IAtmelEraseMode = atmelEraseModeTuple[number];

export default class AtmelDfuBootloader extends AbstractDfuBootloader {
  constructor(usb: IUsb, dfuTargetMapping: IDfuTargetMapping) {
    super(usb, dfuTargetMapping);
  }

  isSupportedDevice(): boolean {
    return false;
  }

  async read(
    _size: number,
    _progress: FirmwareWriterProgressListener,
    _phase: FirmwareWriterPhaseListener
  ): Promise<IResult<{ bytes: Uint8Array }>> {
    return errorResultOf('Not implemented yet');
  }

  async verify(
    bytes: Uint8Array,
    progress: FirmwareWriterProgressListener,
    phase: FirmwareWriterPhaseListener
  ): Promise<IEmptyResult> {
    const initializeDeviceResult = await this.dfuInitializeDevice(
      4,
      false,
      true,
      progress
    );
    if (isError(initializeDeviceResult)) {
      return initializeDeviceResult;
    }
    phase('initialized');
    const validateResult = await this.validate(bytes, progress);
    if (isError(validateResult)) {
      return validateResult;
    }
    phase('verified');
    const closeResult = await this.close();
    if (isError(closeResult)) {
      return closeResult;
    }
    phase('closed');
    return successResult();
  }

  async write(
    flashBytes: Uint8Array,
    eepromBytes: Uint8Array | null,
    progress: FirmwareWriterProgressListener,
    phase: FirmwareWriterPhaseListener
  ): Promise<IEmptyResult> {
    const initializeDeviceResult = await this.dfuInitializeDevice(
      4,
      false,
      true,
      progress
    );
    if (isError(initializeDeviceResult)) {
      return initializeDeviceResult;
    }
    phase('initialized');
    const eraseResult = await this.erase(false, progress);
    if (isError(eraseResult)) {
      return eraseResult;
    }
    phase('cleared');
    // FIXME Flash Memory Only
    const flashResult = await this.flash(flashBytes, progress);
    if (isError(flashResult)) {
      return flashResult;
    }
    phase('wrote');
    const validateResult = await this.validate(flashBytes, progress);
    if (isError(validateResult)) {
      return validateResult;
    }
    phase('verified');
    const resetResult = await this.reset(progress);
    if (isError(resetResult)) {
      return resetResult;
    }
    phase('closed');
    return successResult();
  }

  private async reset(
    progress: FirmwareWriterProgressListener
  ): Promise<IEmptyResult> {
    progress('Resetting the device... ');
    const command = Uint8Array.of(0x04, 0x03, 0x00);
    let dfuDownloadResult = await this.dfuDownload(command);
    if (isError(dfuDownloadResult)) {
      return dfuDownloadResult;
    }
    dfuDownloadResult = await this.dfuDownload(new Uint8Array(0));
    if (isError(dfuDownloadResult)) {
      return dfuDownloadResult;
    }
    progress('Success.', false);
    return successResult();
  }

  private createMcuParameters(): {
    validStart: number;
    validEnd: number;
    pageSize: number;
    memorySize: number;
    totalSize: number;
    flashAddressTop: number;
    flashAddressBottom: number;
  } {
    const dfuTargetMapping = this.getDfuTargetMapping();
    const bootloaderBottom =
      dfuTargetMapping.memorySize - dfuTargetMapping.bootloaderSize;
    const flashAddressBottom = 0;
    const flashAddressTop = bootloaderBottom - 1;
    const memoryAddressTop =
      bootloaderBottom + dfuTargetMapping.bootloaderSize - 1;
    return {
      memorySize: memoryAddressTop + 1,
      totalSize: memoryAddressTop + 1,
      validStart: flashAddressBottom,
      validEnd: flashAddressTop,
      pageSize: dfuTargetMapping.flashPageSize,
      flashAddressTop,
      flashAddressBottom,
    };
  }

  private async flash(
    bytes: Uint8Array,
    progress: FirmwareWriterProgressListener
  ): Promise<IEmptyResult> {
    const mcuParams = this.createMcuParameters();
    const data = new Uint16Array(mcuParams.memorySize).fill(0xffff);
    for (let i = 0; i < bytes.length; i++) {
      data[i] = bytes[i];
    }
    const atmelFlashResult = await this.atmelFlash(
      mcuParams.validStart,
      mcuParams.validEnd,
      mcuParams.pageSize,
      mcuParams.memorySize,
      data,
      progress
    );
    if (isError(atmelFlashResult)) {
      return atmelFlashResult;
    }
    return successResult();
  }

  async erase(
    checkBlank: boolean,
    progress: FirmwareWriterProgressListener
  ): Promise<IEmptyResult> {
    const mcuParams = this.createMcuParameters();
    progress(
      `Erase 0x${(
        mcuParams.flashAddressTop - mcuParams.flashAddressBottom
      ).toString(16)} bytes`
    );
    const atmelEraseFlashResult = await this.atmelEraseFlash('all', progress);
    if (isError(atmelEraseFlashResult)) {
      return atmelEraseFlashResult;
    }
    if (checkBlank) {
      const atmelBlankCheckResult = await this.atmelBlankCheck(
        mcuParams.flashAddressBottom,
        mcuParams.flashAddressTop,
        progress
      );
      if (isError(atmelBlankCheckResult)) {
        return atmelBlankCheckResult;
      }
    }
    return successResult();
  }

  private async validate(
    bytes: Uint8Array,
    progress: FirmwareWriterProgressListener
  ): Promise<IEmptyResult> {
    const mcuParams = this.createMcuParameters();
    const dataStart = mcuParams.validStart;
    const dataEnd = mcuParams.validEnd;
    progress(
      `Validating flash: data start:${dataStart.toString(
        16
      )}, data end:${dataEnd.toString(16)}`
    );
    const data = new Uint8Array(mcuParams.totalSize);
    const atmelReadFlashResult = await this.atmelReadFlash(
      dataStart,
      dataEnd,
      data,
      progress
    );
    if (isError(atmelReadFlashResult)) {
      return atmelReadFlashResult;
    }
    return this.validateBuffer(
      data,
      bytes,
      mcuParams.validStart,
      mcuParams.validEnd,
      progress
    );
  }

  private validateBuffer(
    bufferIn: Uint8Array,
    bufferOut: Uint8Array,
    validStart: number,
    validEnd: number,
    progress: FirmwareWriterProgressListener
  ): IEmptyResult {
    progress(
      `Validating image from byte 0x${validStart.toString(
        16
      )} to 0x${validEnd.toString(16)}.`
    );
    progress('Validating... ');
    let invalidDataRegion = 0;
    let invalidOutsideDataRegion = 0;
    for (let i = validStart; i < validEnd; i++) {
      if (bufferOut[i] <= UINT8_MAX) {
        if (bufferOut[i] !== bufferIn[i]) {
          if (invalidDataRegion === 0) {
            progress(
              `Image did not validate at byte: 0x${i.toString(16)} of 0x${(
                validEnd -
                validStart +
                1
              ).toString(16)}`
            );
            progress(
              `Wanted 0x${(0xff & bufferOut[i]).toString(
                16
              )} but read 0x${bufferIn[i].toString(16)}`
            );
          }
          invalidDataRegion++;
        }
      } else {
        if (0xff !== bufferIn[i]) {
          if (invalidDataRegion === 0) {
            progress(
              `Outside program region: byte 0x${i.toString(16)} expected 0xFF`
            );
            progress(`But read 0x${bufferIn[i].toString(16)}`);
          }
          invalidOutsideDataRegion++;
        }
      }
    }
    if (invalidDataRegion + invalidOutsideDataRegion === 0) {
      progress('Success.', false);
      return successResult();
    } else {
      return errorResultOf(
        `${invalidDataRegion} invalid bytes in program region. ${invalidOutsideDataRegion} outside region.`
      );
    }
  }

  private async atmelEraseFlash(
    mode: IAtmelEraseMode,
    progress: FirmwareWriterProgressListener
  ): Promise<IEmptyResult> {
    progress(`Erase flash: mode:${mode}`);
    const command = Uint8Array.of(0x04, 0x00, 0x00);
    switch (mode) {
      case 'block0':
        command[2] = 0x00;
        break;
      case 'block1':
        command[2] = 0x20;
        break;
      case 'block2':
        command[2] = 0x40;
        break;
      case 'block3':
        command[2] = 0x80;
        break;
      case 'all':
        command[2] = 0xff;
        break;
      default:
        return errorResultOf(`Unknown erase mode: ${mode}`);
    }
    progress('Erasing flash...   ');
    const dfuDownloadResult = await this.dfuDownload(command);
    if (isError(dfuDownloadResult)) {
      return dfuDownloadResult;
    }
    const waitUntilErasingFinishedResult = await this.waitUntilErasingFinished(
      new Date().getTime(),
      0,
      progress
    );
    if (isError(waitUntilErasingFinishedResult)) {
      return waitUntilErasingFinishedResult;
    }
    progress('Success.', false);
    progress(`CMD_ERASE status: Erase Done.`);
    return successResult();
  }

  private async waitUntilErasingFinished(
    start: number,
    retries: number,
    progress: FirmwareWriterProgressListener
  ): Promise<IEmptyResult> {
    if (retries > 10) {
      return errorResultOf('Waiting until erasing finished failed: timeout');
    }
    if (new Date().getTime() - start > 20000) {
      return errorResultOf('CMD_ERASE time limit 20 exceeded');
    }
    const dfuGetStatusResult = await this.dfuGetStatus();
    if (isError(dfuGetStatusResult)) {
      await this.dfuClearStatus();
      progress(`CMD_ERASE status check ${retries} returned nonzero`);
      return await this.waitUntilErasingFinished(start, ++retries, progress);
    }
    if (
      dfuGetStatusResult.value.status.status === DFU_STATUS.ERROR_NOTDONE &&
      dfuGetStatusResult.value.status.state === USB_STATE.DFU_DOWNLOAD_BUSY
    ) {
      // eslint-disable-next-line no-unused-vars
      return new Promise<IEmptyResult>((resolve, _reject) => {
        setTimeout(() => {
          this.waitUntilErasingFinished(start, retries, progress)
            .then((result) => {
              resolve(result);
            })
            .catch((e) => {
              resolve(
                errorResultOf(`Waiting until erasing finished failed: ${e}`, e)
              );
            });
        }, 100);
      });
    } else {
      return successResult();
    }
  }

  private async atmelReadFlash(
    dataStart: number,
    dataEnd: number,
    data: Uint8Array,
    progress: FirmwareWriterProgressListener
  ): Promise<IEmptyResult> {
    progress(`Reading 0x${(dataEnd - dataStart + 1).toString(16)} bytes...`);
    let blockStart = dataStart;
    let memoryPage = Math.floor(blockStart / ATMEL_64KB_PAGE);
    const atmelSelectPageResult = await this.atmelSelectPage(memoryPage);
    if (isError(atmelSelectPageResult)) {
      return atmelSelectPageResult;
    }
    while (blockStart <= dataEnd) {
      if (Math.floor(blockStart / ATMEL_64KB_PAGE) !== memoryPage) {
        memoryPage = Math.floor(blockStart / ATMEL_64KB_PAGE);
        const atmelSelectPageResult = await this.atmelSelectPage(memoryPage);
        if (isError(atmelSelectPageResult)) {
          return atmelSelectPageResult;
        }
      }
      let blockEnd = blockStart + ATMEL_MAX_TRANSFER_SIZE - 1;
      if (Math.floor(blockEnd / ATMEL_64KB_PAGE) > memoryPage) {
        blockEnd = ATMEL_64KB_PAGE * memoryPage - 1;
      }
      if (blockEnd > dataEnd) {
        blockEnd = dataEnd;
      }
      progress(
        `Read program data block: 0x${blockStart.toString(
          16
        )} to 0x${blockEnd.toString(16)} (p. ${Math.floor(
          blockEnd / ATMEL_64KB_PAGE
        )}), 0x${blockEnd - blockStart + 1}`
      );
      const atmelReadBlockResult = await this.atmelReadBlock(
        blockStart,
        blockEnd,
        data,
        progress
      );
      if (isError(atmelReadBlockResult)) {
        return atmelReadBlockResult;
      }
      blockStart = blockEnd + 1;
    }
    progress('Success.');
    return successResult();
  }

  private async atmelReadBlock(
    blockStart: number,
    blockEnd: number,
    data: Uint8Array,
    progress: FirmwareWriterProgressListener
  ): Promise<IEmptyResult> {
    const command = Uint8Array.of(0x03, 0x00, 0x00, 0x00, 0x00, 0x00);
    if (blockEnd < blockStart) {
      return errorResultOf(`Start address is after end address`);
    } else if (blockEnd - blockStart + 1 > ATMEL_MAX_TRANSFER_SIZE) {
      return errorResultOf(
        `Transfer size must not exceed ${ATMEL_MAX_TRANSFER_SIZE}`
      );
    }
    command[2] = 0xff & (blockStart >> 8);
    command[3] = 0xff & blockStart;
    command[4] = 0xff & (blockEnd >> 8);
    command[5] = 0xff & blockEnd;
    const dfuDownloadResult = await this.dfuDownload(command);
    if (isError(dfuDownloadResult)) {
      return dfuDownloadResult;
    }
    const dfuUploadResult = await this.dfuUpload(blockEnd - blockStart + 1);
    if (isError(dfuUploadResult)) {
      const dfuGetStatusResult = await this.dfuGetStatus();
      if (isError(dfuGetStatusResult)) {
        return dfuGetStatusResult;
      }
      if (dfuGetStatusResult.value.status.status === DFU_STATUS.ERROR_FILE) {
        progress('The device is read protected');
      }
      await this.dfuClearStatus();
      return dfuUploadResult;
    }
    for (let i = 0; i < blockEnd - blockStart + 1; i++) {
      data[blockStart + i] = dfuUploadResult.value.data.getUint8(i);
    }
    return successResult();
  }

  private async atmelFlash(
    validStart: number,
    validEnd: number,
    pageSize: number,
    memorySize: number,
    data: Uint16Array,
    progress: FirmwareWriterProgressListener
  ): Promise<IEmptyResult> {
    progress(
      `Flash: valid start:${validStart.toString(
        16
      )}, valid end:${validEnd.toString(
        16
      )}, page size:${pageSize}, memory size:${memorySize}, data.length:${
        data.length
      }`
    );

    let memoryPage = 0;

    if (validEnd < validStart) {
      return errorResultOf(
        `No valid target memory, end ${validEnd.toString(
          16
        )} before start ${validStart.toString(16)}`
      );
    }

    for (let page = 0; page < validEnd; page = page + pageSize) {
      let i;
      for (i = 0; i < pageSize; i++) {
        if (data[page + i] <= UINT8_MAX) {
          break;
        }
      }
      if (pageSize !== i) {
        for (i = 0; i < pageSize; i++) {
          if (data[page + i] > UINT8_MAX) {
            data[page + i] = 0xff;
          }
        }
      }
    }

    let dataStart = UINT32_MAX;
    let dataEnd = 0;
    for (let i = 0; i < memorySize; i++) {
      if (data[i] <= UINT8_MAX) {
        dataEnd = i;
        if (dataStart === UINT32_MAX) {
          dataStart = i;
        }
      }
    }

    progress(
      `Flash available from 0x${validStart.toString(
        16
      )} to 0x${validEnd.toString(16)} (64kB p. ${
        validStart / ATMEL_64KB_PAGE
      } to ${validEnd / ATMEL_64KB_PAGE}), 0x${(
        validEnd -
        validStart +
        1
      ).toString(16)} bytes.`
    );
    progress(
      `Data start @ 0x${dataStart.toString(16)}: 64kB p ${
        dataStart / ATMEL_64KB_PAGE
      }; ${pageSize}B p 0x${(dataStart / pageSize).toString(16)} + 0x${(
        dataStart % pageSize
      ).toString(16)} offset.`
    );
    progress(
      `Data end @ 0x${dataEnd.toString(16)}: 64kB p ${
        dataEnd / ATMEL_64KB_PAGE
      }; ${pageSize}B p 0x${(dataEnd / pageSize).toString(16)} + 0x${(
        dataEnd % pageSize
      ).toString(16)} offset.`
    );
    progress(
      `Totals: 0x${(dataEnd - dataStart + 1).toString(16)} bytes, ${
        dataEnd / pageSize - dataStart / pageSize
      } ${pageSize}B pages, ${
        dataEnd / ATMEL_64KB_PAGE - dataStart / ATMEL_64KB_PAGE
      } byte pages.`
    );

    if (dataStart < validStart) {
      return errorResultOf(
        'Data exists outside of the valid target flash region.'
      );
    } else if (dataStart > UINT32_MAX) {
      return errorResultOf('No valid data to flash');
    }

    const atmelBlankCheckResult = await this.atmelBlankCheck(
      dataStart,
      dataEnd,
      progress
    );
    if (isError(atmelBlankCheckResult)) {
      return atmelBlankCheckResult;
    } else if (!atmelBlankCheckResult.value.blank) {
      progress(`The target memory is not blank.`);
      return errorResultOf(`The target memory is not blank.`);
    }

    progress(
      `Programming 0x${(dataEnd - dataStart + 1).toString(16)} bytes...`
    );

    let blockStart = dataStart;
    memoryPage = Math.floor(blockStart / ATMEL_64KB_PAGE);
    const atmelSelectPageResult = await this.atmelSelectPage(memoryPage);
    if (isError(atmelSelectPageResult)) {
      return atmelSelectPageResult;
    }
    while (blockStart <= dataEnd) {
      if (Math.floor(blockStart / ATMEL_64KB_PAGE) !== memoryPage) {
        memoryPage = Math.floor(blockStart / ATMEL_64KB_PAGE);
        const atmelSelectPageResult = await this.atmelSelectPage(memoryPage);
        if (isError(atmelSelectPageResult)) {
          return atmelSelectPageResult;
        }
      }
      let blockEnd: number;
      for (blockEnd = blockStart; blockEnd <= dataEnd; blockEnd++) {
        if (data[blockEnd] > UINT8_MAX) {
          break;
        }
        if (blockEnd - blockStart + 1 > ATMEL_MAX_TRANSFER_SIZE) {
          break;
        }
        if (Math.floor(blockEnd / ATMEL_64KB_PAGE) - memoryPage) {
          break;
        }
      }
      blockEnd--;
      progress(
        `Flash program data block: 0x${blockStart.toString(
          16
        )} to 0x${blockEnd.toString(16)} (p. ${Math.floor(
          blockEnd / ATMEL_64KB_PAGE
        )}), 0x${blockEnd - blockStart + 1}`
      );
      const atmelFlashBlockResult = await this.atmelFlashBlock(
        data,
        blockStart,
        blockEnd
      );
      if (isError(atmelFlashBlockResult)) {
        return atmelFlashBlockResult;
      }
      for (blockStart = blockEnd + 1; blockStart <= dataEnd; blockStart++) {
        if (data[blockStart] <= UINT8_MAX) {
          break;
        }
      }
    }
    progress('Success.');
    return successResult();
  }

  private async atmelFlashBlock(
    bytes: Uint16Array,
    blockStart: number,
    blockEnd: number
  ): Promise<IEmptyResult> {
    console.log(`blockStart:${blockStart} blockEnd:${blockEnd}`);
    const length = blockEnd - blockStart + 1;
    const message = new Uint8Array(ATMEL_MAX_FLASH_BUFFER_SIZE);
    if (blockEnd < blockStart) {
      return errorResultOf(
        `End address 0x${blockEnd.toString(
          16
        )} before start address 0x${blockStart.toString(16)}`
      );
    } else if (ATMEL_MAX_TRANSFER_SIZE < length) {
      return errorResultOf(
        `0x${length.toString(
          16
        )} byte message > MAX TRANSFER SIZE (0x${ATMEL_MAX_TRANSFER_SIZE.toString(
          16
        )}`
      );
    }

    message.fill(0);
    const controlBlockSize = ATMEL_CONTROL_BLOCK_SIZE;
    const alignment = 0;
    const header = 0;
    const data = controlBlockSize + alignment;
    const footer = data + length;
    this.atmelFlashPopulateHeader(
      message,
      header,
      blockStart % ATMEL_64KB_PAGE,
      blockEnd % ATMEL_64KB_PAGE,
      false
    );
    for (let i = 0; i < length; i++) {
      message[data + i] = bytes[blockStart + i];
    }
    this.atmelFlashPopulateFooter(message, footer, 0xffff, 0xffff, 0xffff);
    const messageLength = footer - header + ATMEL_FOOTER_SIZE;
    const dfuDownloadResult = await this.dfuDownload(
      message.slice(0, messageLength)
    );
    if (isError(dfuDownloadResult)) {
      return dfuDownloadResult;
    }
    const dfuGetStatusResult = await this.dfuGetStatus();
    if (isError(dfuGetStatusResult)) {
      return dfuGetStatusResult;
    }
    if (dfuGetStatusResult.value.status.status === DFU_STATUS.OK) {
      console.log('Page write success');
      return successResult();
    } else {
      if (dfuGetStatusResult.value.status.state === USB_STATE.DFU_ERROR) {
        await this.dfuClearStatus();
      }
      return errorResultOf(
        `Page write unsuccessful (err ${
          dfuGetStatusResult.value.status.status
        })`
      );
    }
  }

  private atmelFlashPopulateFooter(
    message: Uint8Array,
    footer: number,
    vendorId: number,
    productId: number,
    bcdFirmware: number
  ): void {
    const crc = 0;
    // CRC 4 bytes
    message[footer] = 0xff & (crc >> 24);
    message[footer + 1] = 0xff & (crc >> 16);
    message[footer + 2] = 0xff & (crc >> 8);
    message[footer + 3] = 0xff & crc;
    // Length of DFU suffix - always 16
    message[footer + 4] = 16;
    // ucdfuSignature  fixed 'DFU'
    message[footer + 5] = 'D'.charCodeAt(0);
    message[footer + 6] = 'F'.charCodeAt(0);
    message[footer + 7] = 'U'.charCodeAt(0);
    // BCD DFU specification number (1.1)
    message[footer + 8] = 0x01;
    message[footer + 9] = 0x10;
    // Vendor ID or 0xFFFF
    message[footer + 10] = 0xff & (vendorId >> 8);
    message[footer + 11] = 0xff & vendorId;
    // Product ID or 0xFFFF
    message[footer + 12] = 0xff & (productId >> 8);
    message[footer + 13] = 0xff & productId;
    // BCD Firmware release number or 0xFFFF
    message[footer + 14] = 0xff & (bcdFirmware >> 8);
    message[footer + 15] = 0xff & bcdFirmware;
  }

  private atmelFlashPopulateHeader(
    message: Uint8Array,
    header: number,
    start: number,
    end: number,
    eeprom: boolean
  ): void {
    message[header] = 0x01;
    message[header + 1] = eeprom ? 0x01 : 0x00;
    message[header + 2] = 0xff & (start >> 8);
    message[header + 3] = 0xff & start;
    message[header + 4] = 0xff & (end >> 8);
    message[header + 5] = 0xff & end;
  }

  private async atmelBlankCheck(
    start: number,
    end: number,
    progress: FirmwareWriterProgressListener
  ): Promise<IResult<{ blank: boolean }>> {
    progress(
      `Checking memory from 0x${start.toString(16)} to 0x${end.toString(16)}...`
    );

    if (end < start) {
      return errorResultOf(
        `End address 0x${end} before start address ${start}`
      );
    }

    let blankUpto = start;
    let currentPage: number;
    let checkUntil: number;

    do {
      currentPage = Math.floor(blankUpto / ATMEL_64KB_PAGE);
      checkUntil = (currentPage + 1) * ATMEL_64KB_PAGE - 1;
      checkUntil = checkUntil > end ? end : checkUntil;
      const atmelSelectPageResult = await this.atmelSelectPage(currentPage);
      if (isError(atmelSelectPageResult)) {
        return atmelSelectPageResult;
      }
      const atmelBlankPageCheckResult = await this.atmelBlankPageCheck(
        blankUpto % ATMEL_64KB_PAGE,
        checkUntil % ATMEL_64KB_PAGE
      );
      if (isError(atmelBlankPageCheckResult)) {
        return atmelBlankPageCheckResult;
      }
      const result = atmelBlankPageCheckResult.value.address;
      if (result === 0) {
        progress(
          `Flash blank from 0x${start.toString(16)} to 0x${checkUntil.toString(
            16
          )}`
        );
        blankUpto = checkUntil + 1;
      } else if (result > 0) {
        blankUpto = result - 1 + ATMEL_64KB_PAGE * currentPage;
        progress(`Flash NOT blank beginning at 0x${blankUpto.toString(16)}`);
        return successResultOf({
          blank: false,
        });
      } else {
        return errorResultOf(
          `Blank check fail error ${result}. Flash status unknown`
        );
      }
    } while (blankUpto < end);
    progress('Empty.');
    return successResultOf({
      blank: true,
    });
  }

  private async atmelSelectPage(memoryPage: number): Promise<IEmptyResult> {
    // FIXME For ATmega32u4 Only
    const command = Uint8Array.of(0x06, 0x03, 0x00, 0x00);
    command[3] = 0xff & memoryPage;
    const dfuDownloadResult = await this.dfuDownload(command);
    if (isError(dfuDownloadResult)) {
      return dfuDownloadResult;
    }
    const dfuGetStatusResult = await this.dfuGetStatus();
    if (isError(dfuGetStatusResult)) {
      return dfuGetStatusResult;
    }
    if (dfuGetStatusResult.value.status.status !== DFU_STATUS.OK) {
      if (dfuGetStatusResult.value.status.state === USB_STATE.DFU_ERROR) {
        await this.dfuClearStatus();
      }
      return errorResultOf(
        `Status ${dfuGetStatusResult.value.status.status} is not OK`
      );
    }
    return successResult();
  }

  private async atmelBlankPageCheck(
    start: number,
    end: number
  ): Promise<IResult<{ address: number }>> {
    const command = Uint8Array.of(0x03, 0x01, 0x00, 0x00, 0x00, 0x00);
    if (end < start) {
      return errorResultOf(
        `End address 0x${end.toString(
          16
        )} before start address 0x${start.toString(16)}`
      );
    } else if (ATMEL_64KB_PAGE <= end) {
      return errorResultOf(`Address out of 64kb (0x10000) byte page range`);
    }
    command[2] = 0xff & (start >> 8);
    command[3] = 0xff & start;
    command[4] = 0xff & (end >> 8);
    command[5] = 0xff & end;
    const dfuDownloadResult = await this.dfuDownload(command);
    if (isError(dfuDownloadResult)) {
      return dfuDownloadResult;
    }
    const dfuGetStatusResult = await this.dfuGetStatus();
    if (isError(dfuGetStatusResult)) {
      return dfuGetStatusResult;
    }
    if (dfuGetStatusResult.value.status.status === DFU_STATUS.OK) {
      console.log(
        `Flash region from 0x${start.toString(16)} to 0x${end.toString(
          16
        )} is blank`
      );
    } else if (
      dfuGetStatusResult.value.status.status === DFU_STATUS.ERROR_CHECK_ERASED
    ) {
      console.log('Region is NOT blank');
      const dfuUploadResult = await this.dfuUpload(2);
      if (isError(dfuUploadResult)) {
        return dfuUploadResult;
      }
      const data = dfuUploadResult.value.data;
      return successResultOf({
        address: (data.getUint8(0) << 8) + data.getUint8(1) + 1,
      });
    } else {
      console.log(
        `The status (${dfuGetStatusResult.value.status.status}) was not OK`
      );
      if (dfuGetStatusResult.value.status.state === USB_STATE.DFU_ERROR) {
        await this.dfuClearStatus();
      }
      return errorResultOf(
        `Status ${dfuGetStatusResult.value.status.status} is not OK`
      );
    }
    return successResultOf({
      address: 0,
    });
  }
}
