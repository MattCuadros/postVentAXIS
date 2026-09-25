import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Base de los iconos: trazo de 1,75 px en el color del texto, 20 px por defecto, decorativos. */
function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ChevronLeftIcon = (p: IconProps) => <Icon {...p}><path d="m12 4-6 6 6 6" /></Icon>;
export const ChevronRightIcon = (p: IconProps) => <Icon {...p}><path d="m8 4 6 6-6 6" /></Icon>;
export const PlusIcon = (p: IconProps) => <Icon {...p}><path d="M10 4v12M4 10h12" /></Icon>;
export const CloseIcon = (p: IconProps) => <Icon {...p}><path d="m5 5 10 10M15 5 5 15" /></Icon>;
export const CheckIcon = (p: IconProps) => <Icon {...p}><path d="m4 10 4 4 8-8" /></Icon>;
export const MapPinIcon = (p: IconProps) => <Icon {...p}><circle cx="10" cy="8" r="3" /><path d="M16 8c0 4.5-6 8-6 8s-6-3.5-6-8a6 6 0 1 1 12 0Z" /></Icon>;
export const CameraIcon = (p: IconProps) => <Icon {...p}><path d="M3 6h3l1-2h6l1 2h3v10H3Z" /><circle cx="10" cy="11" r="3" /></Icon>;
export const PhoneIcon = (p: IconProps) => <Icon {...p}><path d="M6 3 4 5c-1 5 6 12 11 11l2-2-3-2-2 1c-2-1-4-3-5-5l1-2Z" /></Icon>;
export const MailIcon = (p: IconProps) => <Icon {...p}><rect x="3" y="5" width="14" height="10" rx="1" /><path d="m3 6 7 5 7-5" /></Icon>;
export const AlertIcon = (p: IconProps) => <Icon {...p}><path d="M10 3 18 17H2Z" /><path d="M10 8v4M10 15h.01" /></Icon>;
export const InfoIcon = (p: IconProps) => <Icon {...p}><circle cx="10" cy="10" r="7" /><path d="M10 9v5M10 6h.01" /></Icon>;
export const DownloadIcon = (p: IconProps) => <Icon {...p}><path d="M10 3v9m0 0 3-3m-3 3L7 9M4 16h12" /></Icon>;
export const UploadIcon = (p: IconProps) => <Icon {...p}><path d="M10 17V8m0 0 3 3m-3-3L7 11M4 4h12" /></Icon>;
export const SearchIcon = (p: IconProps) => <Icon {...p}><circle cx="9" cy="9" r="5" /><path d="m13 13 4 4" /></Icon>;
export const UserIcon = (p: IconProps) => <Icon {...p}><circle cx="10" cy="7" r="3" /><path d="M4 17c.5-3 2.5-5 6-5s5.5 2 6 5" /></Icon>;
export const PlayIcon = (p: IconProps) => <Icon {...p}><path d="M7 5v10l8-5Z" /></Icon>;
