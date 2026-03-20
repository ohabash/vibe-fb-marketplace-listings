export interface Listing {
  id: string;
  title: string;
  price: { amount: number | null; currency: string; text?: string };
  description: string;
  condition: string;
  category: string;
  unit_details: string[];
  location: {
    city: string;
    state: string;
    postal_code: string;
    country: string;
    coordinates: { latitude: number | null; longitude: number | null };
  };
  availability: string;
  posted_at: string;
  listing_type: string;
  is_shipping_offered: boolean;
  status: "live" | "sold" | "pending";
  post_id: string;
  seller: { name: string; id: string; profile_url: string };
  images: string[];
  url: string;
  dateAdded?: number; // Unix ms — set once on first scrape, never overwritten
  notes?: string;
  hearted?: boolean;
  hearted2?: boolean;
  inferred: {
    pet_friendly: "unknown" | boolean;
    has_view: 1 | 2 | 3;
    neighborhood: 1 | 2 | 3;
    pool: "unknown" | boolean; // display as amenity
    gym: "unknown" | boolean; // display as amenity
    parking: "unknown" | boolean; // display as amenity
    elevator: "unknown" | boolean; // display as amenity
    wifi: "unknown" | boolean; // display as amenity
    terrace: "unknown" | boolean; // display as amenity
    jacuzzi: "unknown" | boolean; // display as amenity
    security: "unknown" | boolean; // display as amenity
    hasFurniture?: "unknown" | boolean; // display as amenity
    hasWasherDryer?: "unknown" | boolean; // display as amenity
    hasWasherDryerInHookUps?: "unknown" | boolean; // display as amenity
    requiresCosigner?: "unknown" | boolean; // display as amenity
  };
}
