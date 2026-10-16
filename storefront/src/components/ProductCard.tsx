---
import { useState } from 'react';

export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  slug: string;
}

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const [hover, setHover] = useState(false);

  return (
    <a href={`/producto/${product.slug}`} 
       className="group block relative overflow-hidden rounded-2xl bg-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
       onMouseEnter={() => setHover(true)}
       onMouseLeave={() => setHover(false)}>
      <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
        <img 
          src={product.image} 
          alt={product.name}
          className={`w-full h-full object-cover transition-transform duration-700 ${hover ? 'scale-110' : 'scale-100'}`}
          loading="lazy"
        />
      </div>
      <div className="p-4">
        <h3 className="font-bold text-lg text-neutral-900 leading-tight group-hover:text-amber-600 transition-colors">
          {product.name}
        </h3>
        <p className="mt-2 text-xl font-black text-neutral-900">
          ${product.price.toFixed(2)} MXN
        </p>
      </div>
    </a>
  );
}