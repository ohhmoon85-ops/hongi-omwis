import { InspectionDetail } from '@/components/quality/InspectionDetail';

export const dynamic = 'force-dynamic';

interface Props { params: { id: string } }

export default function InspectionDetailPage({ params }: Props) {
  return (
    <div className="p-4 sm:p-6">
      <header className="mb-6">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[#c8962e]/80 mb-1">
          검수 상세
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gold-gradient">
          품질 성적서
        </h1>
      </header>

      <InspectionDetail id={params.id} />
    </div>
  );
}
