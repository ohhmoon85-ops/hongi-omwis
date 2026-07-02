import { VendorDetail } from '@/components/vendors/VendorDetail';

export const dynamic = 'force-dynamic';

interface Props { params: { id: string } }

export default function VendorDetailPage({ params }: Props) {
  return (
    <div className="p-4 sm:p-6">
      <VendorDetail id={params.id} />
    </div>
  );
}
