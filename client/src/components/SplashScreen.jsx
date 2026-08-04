import { useState, useEffect, useRef } from "react";
import splashVideo from "../assets/Splashscreen.mp4";

const STORAGE_KEY = "skyntrix_splash_seen";
const FADE_DURATION = 700;

export default function SplashScreen({ onComplete }) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY)) {
      setVisible(false);
      onComplete?.();
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const handleEnd = () => startFade();
    video.addEventListener("ended", handleEnd);

    video.play().catch(() => startFade());

    return () => video.removeEventListener("ended", handleEnd);
  }, [onComplete]);

  function startFade() {
    if (fading) return;
    setFading(true);
    sessionStorage.setItem(STORAGE_KEY, "1");
    setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, FADE_DURATION);
  }

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black transition-opacity duration-700 ${
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        src={splashVideo}
        muted
        playsInline
        className="w-full h-full object-cover"
      />
    </div>
  );
}
