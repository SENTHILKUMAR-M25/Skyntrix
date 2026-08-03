import {
  FaGlobe, FaMobileAlt, FaPhone, FaPaintBrush, FaShareAlt, FaImage,
  FaBrush, FaSearch, FaWrench, FaRocket, FaBriefcase, FaHeartbeat,
  FaGraduationCap, FaHome, FaUtensils, FaShoppingCart, FaComment,
  FaGem, FaBullseye, FaEye, FaChartLine, FaShieldAlt, FaServer,
  FaNodeJs, FaAws, FaStripe, FaCloud, FaDumbbell
} from "react-icons/fa";
import {
  SiNextdotjs, SiExpress, SiMongodb, SiPostgresql, SiTailwindcss,
  SiFramer, SiReact, SiCloudflare
} from "react-icons/si";
import { HiSparkles, HiBuildingOffice } from "react-icons/hi2";
import { MdFactory, MdSpa } from "react-icons/md";

const icons = {
  globe: FaGlobe,
  phone: FaMobileAlt,
  call: FaPhone,
  palette: FaPaintBrush,
  share: FaShareAlt,
  image: FaImage,
  brush: FaBrush,
  search: FaSearch,
  wrench: FaWrench,
  rocket: FaRocket,
  briefcase: FaBriefcase,
  tower: HiBuildingOffice,
  heart: FaHeartbeat,
  graduation: FaGraduationCap,
  home: FaHome,
  utensils: FaUtensils,
  sparkle: HiSparkles,
  dumbbell: FaDumbbell,
  factory: MdFactory,
  cart: FaShoppingCart,
  globeamericas: FaGlobe,
  diamond: FaGem,
  target: FaBullseye,
  eye: FaEye,
  chart: FaChartLine,
  shield: FaShieldAlt,
  spa: MdSpa,
  react: SiReact,
  next: SiNextdotjs,
  node: FaNodeJs,
  express: SiExpress,
  mongo: SiMongodb,
  postgres: SiPostgresql,
  tailwind: SiTailwindcss,
  motion: SiFramer,
  gsap: SiCloudflare,
  aws: FaAws,
  stripe: FaStripe,
  cloud: FaCloud,
  server: FaServer
};

export function Icon({ name, className = "", ...props }) {
  const Cmp = icons[name] || FaGlobe;
  return <Cmp className={className} {...props} />;
}