import Image from "next/image";
import { isAllowedImageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

export function ProductImage({
  src,
  alt,
  className,
  sizes,
  priority = false,
}: {
  src: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const candidate = src || "/products/placeholder.svg";
  const image = isAllowedImageUrl(candidate)
    ? candidate
    : "/products/placeholder.svg";
  return (
    <Image
      src={image}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes ?? "(max-width: 768px) 100vw, 33vw"}
      className={cn("object-cover", className)}
      unoptimized={image.endsWith(".svg")}
    />
  );
}
