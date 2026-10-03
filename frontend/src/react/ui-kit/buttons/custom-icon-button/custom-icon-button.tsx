'use client';

// Client component: MUI's Tooltip clones its child to attach handlers, which only works when the
// child is created in the same client tree (from a Server Component it got an extra <span> on the
// client only, i.e. a hydration mismatch).
import type { ButtonProps } from '@mui/material';
import { IconButton, Tooltip } from '@mui/material';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import type { ICONS } from '@react-ui-kit/icons/icon-paths';

export interface ICustomButton extends ButtonProps {
  width: number;
  height: number;
  tooltipText?: string;
  tooltipPlacement?:
    | 'bottom'
    | 'left'
    | 'right'
    | 'top'
    | 'bottom-end'
    | 'bottom-start'
    | 'left-end'
    | 'left-start'
    | 'right-end'
    | 'right-start'
    | 'top-end'
    | 'top-start';
  icon: (typeof ICONS)[keyof typeof ICONS];
  iconStyle?: CSSProperties;
  /** With `href` the button renders as a link; these are forwarded to the <a>. */
  target?: string;
  rel?: string;
}

export const CustomIconButton = ({
  width,
  height,
  icon,
  tooltipPlacement = 'top',
  tooltipText,
  iconStyle,
  ...rest
}: ICustomButton) => {
  return (
    <>
      {!tooltipText ? (
        <IconButton {...rest}>
          <Image src={icon} width={width} height={height} alt="icon" style={iconStyle} />
        </IconButton>
      ) : (
        <Tooltip title={tooltipText} placement={tooltipPlacement}>
          <IconButton {...rest}>
            <Image src={icon} width={width} height={height} alt="icon" style={iconStyle} />
          </IconButton>
        </Tooltip>
      )}
    </>
  );
};
