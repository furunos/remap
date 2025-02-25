/* eslint-disable no-undef */
import React from 'react';
import './Header.scss';
import { HeaderActionsType, HeaderStateType } from './Header.container';
import { Logo } from '../../common/logo/Logo';
import { Avatar, IconButton, Menu, MenuItem } from '@mui/material';
import { Person } from '@mui/icons-material';
import { getGitHubProviderData } from '../../../services/auth/Auth';
import { t } from 'i18next';

type HeaderState = {
  menuAnchorEl: any;
};
type OwnProps = {};
type HeaderProps = OwnProps &
  Partial<HeaderActionsType> &
  Partial<HeaderStateType>;

class Header extends React.Component<HeaderProps, HeaderState> {
  constructor(props: HeaderProps | Readonly<HeaderProps>) {
    super(props);
    this.state = {
      menuAnchorEl: null,
    };
  }

  handleMenuIconClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    this.setState({
      menuAnchorEl: event.currentTarget,
    });
  };

  handleMenuClose = () => {
    this.setState({
      menuAnchorEl: null,
    });
  };

  async handleLogoutMenuClick() {
    await this.props.logout!();
    location.href = '/';
  }

  renderAvatarIcon() {
    const user = this.props.auth!.getCurrentAuthenticatedUserIgnoreNull();
    if (user) {
      const { menuAnchorEl } = this.state;

      const githubProviderDataResult = getGitHubProviderData(user);
      if (!githubProviderDataResult.exists) {
        throw new Error('The user does not have a GitHub Provider data.');
      }
      const githubProviderData = githubProviderDataResult.userInfo!;

      const profileImageUrl = githubProviderData.photoURL || '';
      const profileDisplayName = githubProviderData.displayName || '';
      let avatar: React.ReactNode;
      if (profileImageUrl) {
        avatar = (
          <Avatar
            alt={profileDisplayName}
            src={profileImageUrl}
            className="organizations-header-avatar"
          />
        );
      } else {
        avatar = (
          <Avatar className="organizations-header-avatar">
            <Person />
          </Avatar>
        );
      }
      return (
        <React.Fragment>
          <IconButton
            aria-owns={menuAnchorEl ? 'organizations-header-menu' : undefined}
            onClick={this.handleMenuIconClick}
          >
            {avatar}
          </IconButton>
          <Menu
            id="keyboards-header-menu"
            anchorEl={menuAnchorEl}
            open={Boolean(menuAnchorEl)}
            onClose={this.handleMenuClose}
          >
            <MenuItem key="1" onClick={() => this.handleLogoutMenuClick()}>
              {t('Logout')}
            </MenuItem>
          </Menu>
        </React.Fragment>
      );
    } else {
      return null;
    }
  }

  render() {
    return (
      <header className="organizations-header">
        <a href="/" className="organizations-header-logo">
          <Logo width={100} />
        </a>
        <div className="organizations-header-menu-button">
          {this.renderAvatarIcon()}
        </div>
      </header>
    );
  }
}

export default Header;
