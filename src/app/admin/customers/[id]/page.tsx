import { CustomerDetail } from '@/components/admin/CustomerDetail';

interface Params { id: string }

export default function CustomerDetailPage({ params }: { params: Params }) {
  return (
    <div className="p-4 sm:p-6">
      <CustomerDetail customerId={params.id} />
    </div>
  );
}
