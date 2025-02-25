import React from 'react';
import './EditOrganization.scss';
import {
  EditOrganizationActionsType,
  EditOrganizationStateType,
} from './EditOrganization.container';
import {
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { Button } from '@mui/material';
import { Delete } from '@mui/icons-material';
import { IOrganizationMember } from '../../../services/storage/Storage';
import { t } from 'i18next';

type EditOrganizationState = {
  openConfirmDialog: boolean;
  targetMemberUid: string | undefined;
};
type OwnProps = {};
type EditOrganizationProps = OwnProps &
  Partial<EditOrganizationActionsType> &
  Partial<EditOrganizationStateType>;

export default class EditOrganization extends React.Component<
  EditOrganizationProps,
  EditOrganizationState
> {
  constructor(props: EditOrganizationProps | Readonly<EditOrganizationProps>) {
    super(props);
    this.state = {
      openConfirmDialog: false,
      targetMemberUid: undefined,
    };
  }

  handleBackButtonClick = () => {
    location.href = '/organizations';
  };

  handleAddOrganizationMemberClick = () => {
    this.props.addOrganizationMember!();
  };

  handleDeleteMemberClick = (member: IOrganizationMember) => {
    this.setState({ targetMemberUid: member.uid });
    this.setState({ openConfirmDialog: true });
  };

  handleConfirmNoClick = () => {
    this.setState({ openConfirmDialog: false });
  };

  handleConfirmYesClick = () => {
    this.setState({ openConfirmDialog: false });
    this.props.deleteOrganizationMember!(this.state.targetMemberUid!);
  };

  render() {
    return (
      <React.Fragment>
        <div className="edit-organization-wrapper">
          <div className="edit-organization-container">
            <div className="edit-organization-card">
              <Card>
                <CardContent>
                  <div className="edit-organization-header">
                    <Button
                      style={{ marginRight: '16px' }}
                      onClick={this.handleBackButtonClick}
                    >
                      &lt; {t('Organization List')}
                    </Button>
                  </div>
                  <div className="edit-organization-form">
                    <div className="edit-organization-form-row">
                      <TextField
                        id="edit-organization-name"
                        label={t('Name')}
                        variant="outlined"
                        value={this.props.organization!.name}
                        InputProps={{
                          readOnly: true,
                        }}
                      />
                    </div>
                    <div className="edit-organization-form-row">
                      <TextField
                        id="edit-organization-description"
                        label={t('Description')}
                        variant="outlined"
                        multiline
                        rows={4}
                        value={this.props.organization!.description}
                        InputProps={{
                          readOnly: true,
                        }}
                      />
                    </div>
                    <div className="edit-organization-form-row">
                      <TextField
                        id="edit-organization-icon-image-url"
                        label={t('Icon Image URL')}
                        variant="outlined"
                        value={this.props.organization!.icon_image_url}
                        InputProps={{
                          readOnly: true,
                        }}
                      />
                    </div>
                    <div className="edit-organization-form-row">
                      <TextField
                        id="edit-organization-contact-email-address"
                        label={t('Contact Email Address')}
                        variant="outlined"
                        value={this.props.organization!.contact_email_address}
                        InputProps={{
                          readOnly: true,
                        }}
                      />
                    </div>
                    <div className="edit-organization-form-row">
                      <TextField
                        id="edit-organization-contact-person-name"
                        label={t('Contact Person Name')}
                        variant="outlined"
                        value={this.props.organization!.contact_person_name}
                        InputProps={{
                          readOnly: true,
                        }}
                      />
                    </div>
                    <div className="edit-organization-form-row">
                      <TextField
                        id="edit-organization-contact-tel"
                        label={t('Contact Telephone Number')}
                        variant="outlined"
                        value={this.props.organization!.contact_tel}
                        InputProps={{
                          readOnly: true,
                        }}
                      />
                    </div>
                    <div className="edit-organization-form-row">
                      <TextField
                        id="edit-organization-contact-address"
                        label={t('Contact Address')}
                        variant="outlined"
                        value={this.props.organization!.contact_address}
                        InputProps={{
                          readOnly: true,
                        }}
                      />
                    </div>
                    <div className="edit-organization-form-row">
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6">{t('Members')}</Typography>
                          <List>
                            {this.props.organizationMembers!.map(
                              (member, index) => (
                                <ListItem key={index}>
                                  <ListItemText
                                    primary={member.displayName}
                                    secondary={member.email}
                                  />
                                  <ListItemSecondaryAction>
                                    <IconButton
                                      edge="end"
                                      // eslint-disable-next-line no-unused-vars
                                      onClick={(_event: React.MouseEvent) => {
                                        this.handleDeleteMemberClick(member);
                                      }}
                                      disabled={member.me}
                                    >
                                      <Delete />
                                    </IconButton>
                                  </ListItemSecondaryAction>
                                </ListItem>
                              )
                            )}
                          </List>
                          <div className="edit-organization-form-member-form">
                            <TextField
                              className="edit-organization-form-member-form-email"
                              required
                              label={t('Email Address')}
                              value={this.props.email}
                              onChange={(
                                event: React.ChangeEvent<HTMLInputElement>
                              ) => {
                                this.props.updateEmail!(event.target.value);
                              }}
                            />
                            <Button
                              variant="contained"
                              color="primary"
                              onClick={this.handleAddOrganizationMemberClick.bind(
                                this
                              )}
                              className="edit-organization-form-member-form-button"
                              disabled={this.props.email!.length === 0}
                            >
                              {t('Add')}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        <Dialog
          open={this.state.openConfirmDialog}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">{t('Confirmation')}</DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description" color="secondary">
              {t('Are you sure to delete the member from this organization?')}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              color="primary"
              autoFocus
              onClick={this.handleConfirmNoClick}
            >
              {t('No')}
            </Button>
            <Button color="primary" onClick={this.handleConfirmYesClick}>
              {t('Yes')}
            </Button>
          </DialogActions>
        </Dialog>
      </React.Fragment>
    );
  }
}
