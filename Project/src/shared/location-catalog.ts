export interface LocationCountry { code: string; name: string; aliases: string[] }
export interface LocationCity { id: string; name: string; countryCode: string; region: string; lat: number | null; lng: number | null; population: number }
