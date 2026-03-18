export interface Listing {
  id: string;
  title: string;
  price: { amount: number | null; currency: string };
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
  post_id: string;
  seller: { name: string; id: string; profile_url: string };
  images: string[];
  url: string;
  dateAdded?: number; // Unix ms — set once on first scrape, never overwritten
  notes?: string;
  inferred: {
    pet_friendly: "unknown" | boolean;
    has_view: 1 | 2 | 3;
    neighborhood: 1 | 2 | 3;
  };
}
