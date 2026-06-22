import { CustomerDetail } from '@/components/admin/CustomerDetail';

interface Params { id: string }

export default function CustomerDetailPage({ params }: { params: Params }) {
  return (
    <div className="min-h-screen bg-[#0f1117] p-4 sm:p-6 text-white">
      <CustomerDetail customerId={params.id} />
    </div>
  );
}
