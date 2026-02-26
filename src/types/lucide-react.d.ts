import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  absoluteStrokeWidth?: boolean;
}

type LucideIcon = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

declare module "lucide-react" {
  export const AlertTriangle: LucideIcon;
  export const Check: LucideIcon;
  export const CheckCircle: LucideIcon;
  export const CheckIcon: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const ChevronDownIcon: LucideIcon;
  export const ChevronUp: LucideIcon;
  export const ChevronUpIcon: LucideIcon;
  export const Info: LucideIcon;
  export const Loader2: LucideIcon;
  export const Lock: LucideIcon;
  export const Moon: LucideIcon;
  export const ScanLine: LucideIcon;
  export const ShieldCheck: LucideIcon;
  export const Sparkles: LucideIcon;
  export const Sun: LucideIcon;
  export const XCircle: LucideIcon;
  export const XIcon: LucideIcon;
  export const Zap: LucideIcon;
}
