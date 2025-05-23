import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  IBuildableFirmwareFileType,
  IWorkbenchProject,
  IWorkbenchProjectFile,
} from '../../../services/storage/Storage';
import { useForm, Controller, ValidateResult } from 'react-hook-form';
import { t } from 'i18next';

interface EditFileForm {
  fileName: string;
}

type EditWorkbenchProjectFileDialogProps = {
  open: boolean;
  onClose: () => void;
  file: IWorkbenchProjectFile | undefined;
  fileType: IBuildableFirmwareFileType;
  workbenchProject: IWorkbenchProject | undefined;
  onSubmit: (
    path: string,
    file: IWorkbenchProjectFile | undefined,
    fileType: IBuildableFirmwareFileType
  ) => void;
  onDelete: (
    file: IWorkbenchProjectFile | undefined,
    fileType: IBuildableFirmwareFileType
  ) => void;
};

export function EditWorkbenchProjectFileDialog(
  props: EditWorkbenchProjectFileDialogProps
) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EditFileForm>({
    values: {
      fileName: props.file?.path || '',
    },
  });

  const onSubmit = (data: EditFileForm) => {
    props.onSubmit(data.fileName, props.file, props.fileType);
  };

  const validateFileName = (
    value: string,
    fileType: IBuildableFirmwareFileType
  ): ValidateResult => {
    if (props.workbenchProject === undefined) {
      return t('Project not found');
    }
    const files =
      fileType === 'keyboard'
        ? props.workbenchProject.keyboardFiles
        : props.workbenchProject.keymapFiles;
    const fileName = value.trim();
    if (
      files
        .filter((x) => x.id !== props.file?.id)
        .map((x) => x.path)
        .includes(fileName)
    ) {
      return t('File name already exists');
    }
    return true;
  };

  return (
    <Dialog open={props.open} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{t('Edit File')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body1">
              <strong>{t('Target directory')}:</strong>{' '}
              {props.fileType === 'keyboard'
                ? `Keyboards/${props.workbenchProject?.keyboardDirectoryName || '...'}/`
                : `Keyboards/${props.workbenchProject?.keyboardDirectoryName || '...'}/keymaps/remap/`}
            </Typography>
            <Controller
              name="fileName"
              control={control}
              rules={{
                required: t('File name is required'),
                validate: (value): ValidateResult => {
                  return validateFileName(value, props.fileType);
                },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t('File Name')}
                  size="small"
                  fullWidth
                  error={!!errors.fileName}
                  helperText={errors.fileName ? errors.fileName.message : ''}
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            color="warning"
            onClick={() => {
              props.onDelete(props.file, props.fileType);
              props.onClose();
            }}
          >
            {t('Delete')}
          </Button>
          <Button type="submit">{t('Edit')}</Button>
          <Button onClick={props.onClose}>{t('Close')}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
