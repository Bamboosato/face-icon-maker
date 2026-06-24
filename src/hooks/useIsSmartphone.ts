import { useEffect, useState } from "react";

const SMARTPHONE_MEDIA_QUERY = "(max-width: 759px) and (pointer: coarse)";
const SMARTPHONE_USER_AGENT_PATTERN = /Android.*Mobile|iPhone|iPod|Windows Phone/i;

export function useIsSmartphone() {
  const [isSmartphone, setIsSmartphone] = useState(getIsSmartphone);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(SMARTPHONE_MEDIA_QUERY);
    const handleChange = () => setIsSmartphone(getIsSmartphone());

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isSmartphone;
}

function getIsSmartphone() {
  if (typeof navigator !== "undefined") {
    const navigatorWithUserAgentData = navigator as Navigator & {
      userAgentData?: { mobile?: boolean };
    };

    if (navigatorWithUserAgentData.userAgentData?.mobile === true) {
      return true;
    }

    if (SMARTPHONE_USER_AGENT_PATTERN.test(navigator.userAgent)) {
      return true;
    }
  }

  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia(SMARTPHONE_MEDIA_QUERY).matches;
}
