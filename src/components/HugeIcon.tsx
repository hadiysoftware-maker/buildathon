"use client";

import React from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

export interface HugeIconWrapperProps {
  className?: string;
  size?: number | string;
  strokeWidth?: number;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean;
  onClick?: React.MouseEventHandler<HTMLElement>;
}

function makeIcon(name: IconName) {
  const Comp = ({ className = "h-4 w-4", size, strokeWidth = 1.85, style, onClick }: HugeIconWrapperProps) => {
    const px = typeof size === "number" ? size : typeof size === "string" ? parseInt(size, 10) || 20 : 20;
    const iconEl = (
      <Icon
        name={name}
        size={px}
        strokeWidth={strokeWidth}
        className={`shrink-0 ${className}`}
        style={style}
      />
    );
    if (onClick) {
      return (
        <span onClick={onClick} className="inline-flex items-center justify-center cursor-pointer">
          {iconEl}
        </span>
      );
    }
    return iconEl;
  };
  Comp.displayName = `HugeIcon_${name}`;
  return Comp;
}

export { Icon, type IconName };

// All icon components used across DNAC-MS mapped strictly to @hugeicons/core-free-icons
export const Activity = makeIcon("activity");
export const AlertCircle = makeIcon("alertCircle");
export const AlertTriangle = makeIcon("alert");
export const Archive = makeIcon("archive");
export const ArrowDownLeft = makeIcon("arrowDownLeft");
export const ArrowLeft = makeIcon("back");
export const ArrowRight = makeIcon("next");
export const ArrowUpCircle = makeIcon("up");
export const ArrowUpDown = makeIcon("upDown");
export const ArrowUpRight = makeIcon("arrowUpRight");
export const Award = makeIcon("award");
export const Backpack = makeIcon("backpack");
export const Banknote = makeIcon("banknote");
export const BarChart = makeIcon("barChart");
export const BarChart3 = makeIcon("chart");
export const Bell = makeIcon("bell");
export const BookOpen = makeIcon("courses");
export const Briefcase = makeIcon("briefcase");
export const Building = makeIcon("building");
export const Building2 = makeIcon("building2");
export const BuildingIcon = makeIcon("building2");
export const Bus = makeIcon("bus");
export const Calendar = makeIcon("calendar");
export const CalendarCheck = makeIcon("calendarCheck");
export const CalendarClock = makeIcon("calendarAlt");
export const CalendarDays = makeIcon("calendar");
export const CalendarIcon = makeIcon("calendar");
export const CalendarRange = makeIcon("calendarAlt");
export const Camera = makeIcon("camera");
export const Check = makeIcon("check");
export const CheckCheck = makeIcon("checkDouble");
export const CheckCircle = makeIcon("done");
export const CheckCircle2 = makeIcon("done");
export const CheckSquare = makeIcon("checkSquare");
export const ChevronDown = makeIcon("down");
export const ChevronLeft = makeIcon("back");
export const ChevronRight = makeIcon("next");
export const ChevronUp = makeIcon("up");
export const ChevronsUpDown = makeIcon("upDown");
export const Circle = makeIcon("square");
export const CircleUser = makeIcon("account");
export const ClipboardCheck = makeIcon("clipboard");
export const ClipboardList = makeIcon("clipboard");
export const Clock = makeIcon("clock");
export const CloudDownload = makeIcon("cloudDownload");
export const CloudUpload = makeIcon("cloudUpload");
export const Code = makeIcon("code");
export const Coins = makeIcon("coins");
export const Copy = makeIcon("copy");
export const Cpu = makeIcon("cpu");
export const CreditCard = makeIcon("creditCard");
export const Database = makeIcon("database");
export const Download = makeIcon("download");
export const Edit = makeIcon("edit");
export const Edit2 = makeIcon("editAlt");
export const Edit3 = makeIcon("edit");
export const ExternalLink = makeIcon("external");
export const Eye = makeIcon("show");
export const EyeOff = makeIcon("hide");
export const FileBarChart = makeIcon("chart");
export const FileChartLine = makeIcon("chart");
export const FileDown = makeIcon("download");
export const FileEdit = makeIcon("edit");
export const FileIcon = makeIcon("file");
export const FileSpreadsheet = makeIcon("spreadsheet");
export const FileText = makeIcon("file");
export const Filter = makeIcon("filter");
export const Fingerprint = makeIcon("fingerprint");
export const Folder = makeIcon("folder");
export const Ghost = makeIcon("ghost");
export const Gift = makeIcon("gift");
export const Globe = makeIcon("globe");
export const GraduationCap = makeIcon("graduation");
export const Hash = makeIcon("hash");
export const Heart = makeIcon("heart");
export const HeartPulse = makeIcon("heartPulse");
export const HelpCircle = makeIcon("help");
export const History = makeIcon("history");
export const Home = makeIcon("home");
export const Image = makeIcon("image");
export const Inbox = makeIcon("inbox");
export const Info = makeIcon("info");
export const Key = makeIcon("key");
export const KeyRound = makeIcon("key");
export const Landmark = makeIcon("bank");
export const Layers = makeIcon("layers");
export const Layout = makeIcon("layout");
export const LayoutDashboard = makeIcon("dashboard");
export const LayoutGrid = makeIcon("layoutGrid");
export const Link = makeIcon("link");
export const List = makeIcon("list");
export const Loader2 = makeIcon("loader");
export const Lock = makeIcon("lock");
export const LogOut = makeIcon("signout");
export const Mail = makeIcon("mail");
export const MapPin = makeIcon("mapPin");
export const Medal = makeIcon("medal");
export const Megaphone = makeIcon("megaphone");
export const Menu = makeIcon("menu");
export const MessageSquare = makeIcon("message");
export const MessageSquarePlus = makeIcon("messagePlus");
export const Minus = makeIcon("minus");
export const MinusCircle = makeIcon("minus");
export const Monitor = makeIcon("monitor");
export const Moon = makeIcon("moon");
export const MoreHorizontal = makeIcon("moreH");
export const MoreVertical = makeIcon("more");
export const Package = makeIcon("package");
export const Pencil = makeIcon("editAlt");
export const Phone = makeIcon("phone");
export const PieChart = makeIcon("pieChart");
export const PiggyBank = makeIcon("piggyBank");
export const Play = makeIcon("play");
export const Plus = makeIcon("add");
export const PlusCircle = makeIcon("addCircle");
export const PlusSquare = makeIcon("plusCircle");
export const Power = makeIcon("power");
export const Printer = makeIcon("printer");
export const QrCode = makeIcon("qr");
export const Radio = makeIcon("radio");
export const Receipt = makeIcon("billing");
export const RefreshCcw = makeIcon("refresh");
export const RefreshCw = makeIcon("refresh");
export const RotateCcw = makeIcon("rotateLeft");
export const Save = makeIcon("save");
export const School = makeIcon("institution");
export const Search = makeIcon("search");
export const Send = makeIcon("send");
export const Settings = makeIcon("settings");
export const Settings2 = makeIcon("manage");
export const Share2 = makeIcon("share");
export const Shield = makeIcon("shield");
export const ShieldAlert = makeIcon("shieldAlert");
export const ShieldCheck = makeIcon("shieldCheck");
export const ShieldOff = makeIcon("shieldAlert");
export const ShoppingBag = makeIcon("shoppingBag");
export const ShoppingCart = makeIcon("cart");
export const Signal = makeIcon("signal");
export const SignalLow = makeIcon("signal");
export const Sliders = makeIcon("sliders");
export const SlidersHorizontal = makeIcon("sliders");
export const Smartphone = makeIcon("smartphone");
export const Smile = makeIcon("smile");
export const Sparkles = makeIcon("sparkles");
export const Square = makeIcon("square");
export const Star = makeIcon("star");
export const StickyNote = makeIcon("note");
export const Store = makeIcon("store");
export const Sun = makeIcon("sun");
export const Tag = makeIcon("tag");
export const Thermometer = makeIcon("thermometer");
export const Ticket = makeIcon("ticket");
export const Trash2 = makeIcon("delete");
export const TrendingDown = makeIcon("trendDown");
export const TrendingUp = makeIcon("trendUp");
export const Trophy = makeIcon("trophy");
export const Truck = makeIcon("truck");
export const Unlink = makeIcon("unlink");
export const Upload = makeIcon("upload");
export const User = makeIcon("user");
export const UserCheck = makeIcon("userCheck");
export const UserCircle = makeIcon("account");
export const UserCircle2 = makeIcon("account");
export const UserMinus = makeIcon("userMinus");
export const UserPlus = makeIcon("userAdd");
export const UserSearch = makeIcon("userSearch");
export const UserX = makeIcon("userRemove");
export const Users = makeIcon("group");
export const Verified = makeIcon("verified");
export const Wallet = makeIcon("wallet");
export const Wallet2 = makeIcon("wallet");
export const Wifi = makeIcon("wifi");
export const WifiOff = makeIcon("wifiOff");
export const Wrench = makeIcon("wrench");
export const X = makeIcon("close");
export const XCircle = makeIcon("closeCircle");
export const Zap = makeIcon("zap");
export const ZapOff = makeIcon("zapOff");
