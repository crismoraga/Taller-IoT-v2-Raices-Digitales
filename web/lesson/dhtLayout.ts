import { useEffect, useState } from "react";
import { readLocal, writeLocal } from "../lib/theme";
import { DHT_PIN_ORDERS, type DhtPinOrder } from "./assembly";

const KEY = "raices.dht11.pin-order";
const EVENT = "raices:dht-pin-order";
const validOrder = (value: unknown): value is DhtPinOrder =>
  typeof value === "string" && Object.hasOwn(DHT_PIN_ORDERS, value);

/** The physical module has one printed order across lessons and boards. */
export function readDhtPinOrder(): DhtPinOrder {
  const value = readLocal<unknown>(KEY, "vcc-data-gnd");
  return validOrder(value) ? value : "vcc-data-gnd";
}

export function useDhtPinOrder() {
  const [order, setOrder] = useState<DhtPinOrder>(readDhtPinOrder);
  useEffect(() => {
    const changed = (event: Event) => {
      const value: unknown = (event as CustomEvent).detail;
      setOrder(validOrder(value) ? value : readDhtPinOrder());
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === KEY || event.key === null) setOrder(readDhtPinOrder());
    };
    window.addEventListener(EVENT, changed);
    window.addEventListener("storage", storageChanged);
    return () => {
      window.removeEventListener(EVENT, changed);
      window.removeEventListener("storage", storageChanged);
    };
  }, []);
  const update = (value: DhtPinOrder) => {
    if (!validOrder(value)) return;
    setOrder(value);
    writeLocal(KEY, value);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
  };
  return [order, update] as const;
}
