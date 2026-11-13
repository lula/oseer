import {
  CheckboxField,
  DatePickerField,
  DateTimePickerField,
  NumberField,
  PasswordField,
  SelectField,
  SwitchField,
  TextareaField,
  TextField,
  UncontrolledField,
} from "./fields/index";
import { FormErrors, SubmitButton } from "./form-components/index";

/** The generic fields, for `createFormHook({ fieldComponents })`. */
export const FIELD_COMPONENTS = {
  TextField,
  PasswordField,
  UncontrolledField,
  NumberField,
  TextareaField,
  DatePickerField,
  DateTimePickerField,
  CheckboxField,
  SelectField,
  SwitchField,
};

/** The form-level components, for `createFormHook({ formComponents })`. */
export const FORM_COMPONENTS = { SubmitButton, FormErrors };
