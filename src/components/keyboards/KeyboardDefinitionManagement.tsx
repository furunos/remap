import React, { useEffect, useState } from 'react';
import {
  KeyboardDefinitionManagementActionsType,
  KeyboardDefinitionManagementStateType,
} from './KeyboardDefinitionManagement.container';
import {
  OptionsObject,
  ProviderContext,
  SnackbarKey,
  withSnackbar,
} from 'notistack';
import { NotificationItem } from '../../actions/actions';
import { Button, CssBaseline } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Header from './header/Header.container';
import Content from './content/Content.container';
import { getGitHubProviderData } from '../../services/auth/Auth';
import { useParams } from 'react-router';

type ParamsType = {
  definitionId: string;
};
type OwnProps = {};
type KeyboardDefinitionManagementProps = OwnProps &
  Partial<KeyboardDefinitionManagementStateType> &
  Partial<KeyboardDefinitionManagementActionsType> &
  ProviderContext;

function KeyboardDefinitionManagement(
  props: KeyboardDefinitionManagementProps
) {
  const [displayedNotificationIds, setDisplayedNotificationIds] = useState<
    string[]
  >([]);

  const storeDisplayedNotification = (key: string) => {
    setDisplayedNotificationIds([...displayedNotificationIds, key]);
  };

  const removeDisplayedNotification = (key: string) => {
    setDisplayedNotificationIds([
      ...displayedNotificationIds.filter((k) => key !== k),
    ]);
  };

  const updateNotifications = () => {
    props.notifications!.forEach((item: NotificationItem) => {
      if (displayedNotificationIds.includes(item.key)) return;

      const snackbarOptions: OptionsObject = {
        key: item.key,
        variant: item.type,
        onExited: (event, key: React.ReactText) => {
          props.removeNotification!(key as string);
          removeDisplayedNotification(key as string);
        },
        // eslint-disable-next-line react/display-name
        action: (key: SnackbarKey) => (
          <Button
            onClick={() => {
              // eslint-disable-next-line react/prop-types
              props.closeSnackbar(key);
            }}
          >
            <CloseIcon />
          </Button>
        ),
      };

      if (item.type === 'success' || item.type === 'info') {
        snackbarOptions.autoHideDuration = 3000;
        snackbarOptions.persist = false;
      } else {
        snackbarOptions.persist = true;
      }

      props.enqueueSnackbar(item.message, snackbarOptions);
      storeDisplayedNotification(item.key);
    });
  };

  const params = useParams<ParamsType>();

  useEffect(() => {
    props.initializeMeta!();
    props.auth!.subscribeAuthStatus((user) => {
      if (user) {
        if (getGitHubProviderData(user).exists) {
          props.startInitializing!();
          updateNotifications();
          const definitionId = params.definitionId;
          if (definitionId) {
            props.updateKeyboard!(definitionId);
          } else {
            props.updateKeyboards!();
          }
        } else {
          props.auth!.linkToGitHub().then(() => {
            // N/A
          });
        }
      } else {
        if (props.phase !== 'signout') {
          props.auth!.signInWithGitHub().then(() => {
            // N/A
          });
        }
      }
    });
  }, []);

  useEffect(() => {
    updateNotifications();
  }, [props.notifications]);

  if (props.phase !== 'signing') {
    return (
      <React.Fragment>
        <CssBaseline />
        <Header />
        <main>
          <Content />
        </main>
      </React.Fragment>
    );
  } else {
    return null;
  }
}

export default withSnackbar(KeyboardDefinitionManagement);
