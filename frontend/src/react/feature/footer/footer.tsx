import { SOCIAL_LINKS } from '@helpers/constants';
import { CustomIconButton } from '@react-ui-kit/buttons/custom-icon-button';
import { ICONS } from '@react-ui-kit/icons/icon-paths';

export function Footer() {
  return (
    <footer className="flex items-center justify-center gap-6">
      {SOCIAL_LINKS.map((item) => (
        // The icon button renders as the <a> itself (href): wrapping a <button> in a link is invalid
        // HTML and caused a hydration mismatch.
        <CustomIconButton
          key={item.name}
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          width={24}
          height={24}
          icon={item.icon ?? ICONS.CLOSE}
          tooltipText={`${item.name}`}
          tooltipPlacement="top"
        />
      ))}
    </footer>
  );
}
