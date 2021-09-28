import { RootState } from '../../../../store/state';
import { connect } from 'react-redux';
import FirmwareForm from './FirmwareForm';

const mapStateToProps = (state: RootState) => {
  return {
    definitionDocument: state.entities.keyboardDefinitionDocument,
  };
};
export type FirmwareFormStateType = ReturnType<typeof mapStateToProps>;

const mapDispatchToProps = (_dispatch: any) => {
  return {};
};
export type FirmwareFormActionsType = ReturnType<typeof mapDispatchToProps>;

export default connect(mapStateToProps, mapDispatchToProps)(FirmwareForm);
