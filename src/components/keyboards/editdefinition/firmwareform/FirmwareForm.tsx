import React, { useState } from 'react';
import {
  FirmwareFormActionsType,
  FirmwareFormStateType,
} from './FirmwareForm.container';
import './FirmwareForm.scss';
import CircularProgressWithLabel from '../CircularProgressWithLabel';

type OwnProps = {
  uploading: boolean;
  uploadedRate: number;
  dragging: boolean;
};
type FirmwareFormProps = OwnProps &
  Partial<FirmwareFormActionsType> &
  Partial<FirmwareFormStateType>;

export default function FirmwareForm(props: FirmwareFormProps) {
  const [dragging, setDragging] = useState<boolean>(false);

  return (
    <div className="firmware-form-container">
      <div className="firmware-form-form">
        <div className="edit-definition-catalog-form-upload-image-form">
          {props.uploading ? (
            <div className="edit-definition-catalog-form-upload-image-form-progress">
              <CircularProgressWithLabel value={props.uploadedRate} />
            </div>
          ) : (
            <div
              className={
                dragging
                  ? 'edit-definition-catalog-form-upload-image-form-area edit-definition-catalog-form-upload-image-form-area-active'
                  : 'edit-definition-catalog-form-upload-image-form-area'
              }
              onDragOver={onDragOverFirmwareFile}
              onDrop={onDropFirmwareFile}
              onDragLeave={onDragLeaveFirmwareFile}
            >
              <div
                className="edit-definition-catalog-form-upload-image-form-message"
                ref={dropTargetRef}
              >
                Drop Firmware here
              </div>
            </div>
          )}
          <div
            className="edit-definition-catalog-form-upload-image-form-image"
            style={{
              backgroundImage: `url(${props.definitionDocument!.imageUrl})`,
            }}
          />
        </div>
      </div>
      <div className="firmware-form-list">list</div>
    </div>
  );
}
