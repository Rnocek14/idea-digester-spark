-- Create restaurants table for storing scraped dining data
CREATE TABLE public.restaurants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  website TEXT,
  source_url TEXT,
  address TEXT,
  phone TEXT,
  
  -- Core dining data
  hours JSONB DEFAULT '{}',
  fish_fry JSONB DEFAULT '{}',
  happy_hour JSONB DEFAULT '{}',
  weekly_specials JSONB DEFAULT '[]',
  menu_highlights TEXT[],
  signature_dishes JSONB DEFAULT '[]',
  
  -- Classification
  categories TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  cuisine_types TEXT[] DEFAULT '{}',
  amenities TEXT[] DEFAULT '{}',
  
  -- AI extraction metadata
  extraction_confidence JSONB DEFAULT '{}',
  needs_review BOOLEAN DEFAULT FALSE,
  extraction_notes TEXT,
  
  -- Timestamps
  last_scraped_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- Public read access for restaurants
CREATE POLICY "Restaurants are viewable by everyone" 
ON public.restaurants 
FOR SELECT 
USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage restaurants"
ON public.restaurants
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create index for common queries
CREATE INDEX idx_restaurants_slug ON public.restaurants(slug);
CREATE INDEX idx_restaurants_tags ON public.restaurants USING GIN(tags);
CREATE INDEX idx_restaurants_categories ON public.restaurants USING GIN(categories);

-- Updated_at trigger
CREATE TRIGGER update_restaurants_updated_at
BEFORE UPDATE ON public.restaurants
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();