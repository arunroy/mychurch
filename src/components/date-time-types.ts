/** Props shared by the native and web versions of DateField and TimeField. */
export type DateFieldProps = {
  label: string;
  /** A day as YYYY-MM-DD, or an empty string for none. */
  value: string;
  onChange: (next: string) => void;
  hint?: string;
};

export type TimeFieldProps = {
  label: string;
  /** A 24-hour time as HH:MM, or an empty string for none. */
  value: string;
  onChange: (next: string) => void;
  /** Shows a Clear button so the time can be left empty. */
  optional?: boolean;
  hint?: string;
};
