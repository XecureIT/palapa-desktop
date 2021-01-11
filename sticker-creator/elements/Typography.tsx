import * as React from 'react';
import * as classnames from 'classnames';
import * as styles from './Typography.scss';

export type Props = {
  children: React.ReactNode;
};

export type HeadingProps = React.HTMLProps<HTMLHeadingElement>;
export type ParagraphProps = React.HTMLProps<HTMLParagraphElement> & {
  center?: boolean;
  wide?: boolean;
  secondary?: boolean;
};
export type SpanProps = React.HTMLProps<HTMLSpanElement>;

export const H1 = React.memo(
  ({ children, className, ...rest }: Props & HeadingProps) => (
    <h1 className={classnames(styles.h1, className)} {...rest}>
      {children}
    </h1>
  )
);

export const H2 = React.memo(
  ({ children, className, ...rest }: Props & HeadingProps) => (
    <h2 className={classnames(styles.h2, className)} {...rest}>
      {children}
    </h2>
  )
);

export const Text = React.memo(
  ({
    children,
    className,
    center,
    wide,
    secondary,
    ...rest
  }: Props & ParagraphProps) => (
    <p
      className={classnames(
        center ? styles.textCenter : styles.text,
        secondary ? styles.secondary : null,
        className
      )}
      {...rest}
    >
      {children}
    </p>
  )
);

export const Inline = React.memo(
  ({ children, className, ...rest }: Props & SpanProps) => (
    <span className={classnames(styles.text, className)} {...rest}>
      {children}
    </span>
  )
);
