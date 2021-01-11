import * as React from 'react';
import * as styles from './LabeledInput.scss';
import { Inline } from './Typography';

export type Props = {
  children: React.ReactNode;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => unknown;
};

export const LabeledInput = React.memo(
  ({ children, value, placeholder, onChange }: Props) => {
    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.currentTarget.value);
      },
      [onChange]
    );

    return (
      <label className={styles.container}>
        <Inline className={styles.label}>{children}</Inline>
        <input
          type="text"
          className={styles.input}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
        />
      </label>
    );
  }
);
