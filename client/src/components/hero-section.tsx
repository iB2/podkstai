import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useState } from "react";

interface HeroSectionProps {
  title?: string;
  subtitle?: string;
  gradient?: string;
  imageSrc?: string;
  imageAlt?: string;
}

export function HeroSection({ 
  title = "Transform Text to Podcast", 
  subtitle = "Create professional-sounding podcasts from text conversations with just a few clicks",
  gradient = "from-[#F3930B]/80 to-[#D97706]/80",
  imageSrc = "/podcast-hero-default.jpg",
  imageAlt = "Podcast studio setup"
}: HeroSectionProps) {
  const [imageError, setImageError] = useState(false);

  // Fallback gradient when image fails to load
  const gradientStyle = imageError 
    ? { 
        background: "linear-gradient(135deg, #F3930B 0%, #D97706 100%)",
        height: "300px"
      } 
    : {};

  return (
    <section className="mb-12 mt-6">
      <div className="rounded-xl overflow-hidden relative" style={gradientStyle}>
        {!imageError && (
          <>
            <div className={`absolute inset-0 bg-gradient-to-r ${gradient} z-10`}></div>
            <AspectRatio ratio={16/5} className="bg-muted">
              <img 
                src={imageSrc} 
                alt={imageAlt} 
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            </AspectRatio>
          </>
        )}
        <div className={`${imageError ? 'relative py-16' : 'absolute inset-0'} flex flex-col justify-center px-6 md:px-12 z-20`}>
          <h2 className="text-2xl md:text-4xl font-bold mb-2 text-foreground">{title}</h2>
          <p className="text-base md:text-lg text-gray-300 max-w-xl">
            {subtitle}
          </p>
        </div>
      </div>
    </section>
  );
}
