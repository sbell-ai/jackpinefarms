import { useEffect } from "react";

export default function FerndeskWidget() {
  useEffect(() => {
    if (!document.getElementById("ferndesk-sdk")) {
      const script = document.createElement("script");
      script.id = "ferndesk-sdk";
      script.src = "https://static.ferndesk.com/dist/sdk.js";
      script.async = true;
      document.body.appendChild(script);
      script.onload = () => {
        (window as any).Ferndesk?.("init", {
          widgetId: "widget_01KNRS8BRMHNEWWZX76ME7X27N"
        });
      };
    } else {
      (window as any).Ferndesk?.("init", {
        widgetId: "widget_01KNRS8BRMHNEWWZX76ME7X27N"
      });
    }

    return () => {
      const sdk = document.getElementById("ferndesk-sdk");
      if (sdk) sdk.remove();
    };
  }, []);

  return null;
}
