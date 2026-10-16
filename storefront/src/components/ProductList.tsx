import { useState } from 'react';
import ProductCard from '../components/ProductCard';

interface Props {
  products: Product[];
}

export default function ProductList({ products }: Props) {
  const [selected, setSelected] = useState<string | undefined>(undefined);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
