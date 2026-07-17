import type { EventType } from "@/lib/types";

export interface DemoEvent {
  source: string;
  source_url: string;
  title: string;
  raw_text: string;
  event_type: EventType;
  region: string;
}

/**
 * Realistic demo events so "Run demo scan" produces a full alert feed instantly.
 * These use stable source_urls under demo.ripple-hq.local so they dedupe cleanly
 * and never collide with real ingested events.
 */
export const DEMO_EVENTS: DemoEvent[] = [
  {
    source: "federal_register",
    source_url: "https://demo.ripple-hq.local/section-301-aluminum-china",
    title:
      "USTR proposes Section 301 tariff increase on aluminum extrusions from China",
    raw_text:
      "The Office of the U.S. Trade Representative published a proposed modification to Section 301 actions, raising duties on aluminum extrusions and related articles (HS headings 7604 and 7616) imported from China from the current general rate to a proposed 27.5 percent. A public comment period is open for 21 days. The effective date, if adopted, would be 60 days after the final notice.",
    event_type: "tariff",
    region: "China",
  },
  {
    source: "gdelt",
    source_url: "https://demo.ripple-hq.local/shenzhen-typhoon-warning",
    title: "Typhoon warning issued for Shenzhen, factories ordered to suspend work",
    raw_text:
      "A severe typhoon is forecast to make landfall near Shenzhen within 48 hours. Local authorities have issued a red warning and ordered many factories and the port to suspend operations. Shipping and manufacturing disruptions of several days are expected across the Pearl River Delta.",
    event_type: "weather",
    region: "Shenzhen, China",
  },
  {
    source: "gdelt",
    source_url: "https://demo.ripple-hq.local/vietnam-port-strike",
    title: "Port workers strike halts container traffic at Ho Chi Minh City",
    raw_text:
      "A labor dispute has led port workers in Ho Chi Minh City, Vietnam to strike, halting container loading and unloading. Textile and footwear exporters warn of shipment delays of one to two weeks. Negotiations are ongoing.",
    event_type: "news",
    region: "Ho Chi Minh City, Vietnam",
  },
  {
    source: "federal_register",
    source_url: "https://demo.ripple-hq.local/antidumping-steel-fasteners",
    title:
      "Commerce initiates antidumping review on steel fasteners from Taiwan",
    raw_text:
      "The Department of Commerce announced the initiation of an antidumping duty administrative review covering certain steel threaded fasteners (HS 7318) from Taiwan. Preliminary results are expected within 120 days. Importers may face retroactive duty adjustments.",
    event_type: "tariff",
    region: "Taiwan",
  },
  {
    source: "gdelt",
    source_url: "https://demo.ripple-hq.local/guangdong-factory-fire",
    title: "Factory fire disrupts electronics production in Dongguan",
    raw_text:
      "A large fire at an electronics components factory in Dongguan, Guangdong, China has halted production. The facility supplies connectors and printed circuit boards. Buyers are being notified of potential delays of several weeks while operations are relocated.",
    event_type: "news",
    region: "Dongguan, China",
  },
  {
    source: "gdelt",
    source_url: "https://demo.ripple-hq.local/india-monsoon-flooding",
    title: "Monsoon flooding disrupts logistics around Mumbai port",
    raw_text:
      "Heavy monsoon rainfall has caused flooding around Mumbai, India, disrupting road and rail links to the port. Exporters of textiles and auto components report container pickup delays. Conditions are expected to persist for several days.",
    event_type: "weather",
    region: "Mumbai, India",
  },
];
