// ============================================================================
// 사업자등록번호 진위확인 — 국세청 공공데이터포털 API
// ----------------------------------------------------------------------------
// API: POST https://api.odcloud.kr/api/nts-businessman/v1/status
// 인증: 공공데이터포털 https://data.go.kr 에서 "국세청_사업자등록정보 진위확인 및 상태조회"
//      서비스 신청 후 발급받은 Encoding 키를 BIZ_VERIFY_API_KEY 로 설정.
// 키 미설정 시: 형식만 검사 (10자리 + 체크섬) — Mock 모드
// ============================================================================

const API_KEY = process.env.BIZ_VERIFY_API_KEY ?? '';
const ENDPOINT = 'https://api.odcloud.kr/api/nts-businessman/v1/status';

export interface BizVerifyResult {
  valid: boolean;             // 사업자 존재 + 휴/폐업 아님
  bizNumber: string;          // 정규화 (하이픈 제거 10자리)
  status?: string;            // 계속사업자 / 휴업자 / 폐업자
  statusCode?: string;        // 01 / 02 / 03
  taxType?: string;           // 일반과세자 / 간이과세자 / 면세사업자 등
  closeDate?: string | null;  // 폐업일자 (YYYYMMDD)
  mock: boolean;              // Mock 모드 여부
  error?: string;
}

// 사업자번호 체크섬 검증 (국세청 알고리즘)
function isValidChecksum(b: string): boolean {
  if (!/^\d{10}$/.test(b)) return false;
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(b[i], 10) * weights[i];
  sum += Math.floor((parseInt(b[8], 10) * 5) / 10);
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(b[9], 10);
}

function normalize(b: string): string {
  return b.replace(/[^0-9]/g, '');
}

export async function verifyBusinessNumber(input: string): Promise<BizVerifyResult> {
  const bizNumber = normalize(input);

  // 형식 검증 — 항상 우선
  if (bizNumber.length !== 10) {
    return { valid: false, bizNumber, mock: true, error: '사업자번호는 10자리 숫자여야 합니다' };
  }
  if (!isValidChecksum(bizNumber)) {
    return { valid: false, bizNumber, mock: true, error: '체크섬 불일치 — 사업자번호 오타 가능' };
  }

  // 키 미설정 → Mock (형식만 통과)
  if (!API_KEY) {
    return {
      valid: true,
      bizNumber,
      status: '형식 OK (실 조회는 API 키 필요)',
      mock: true,
    };
  }

  // 실제 호출
  try {
    const res = await fetch(`${ENDPOINT}?serviceKey=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ b_no: [bizNumber] }),
      cache: 'no-store',
    });
    if (!res.ok) {
      return { valid: false, bizNumber, mock: false, error: `API ${res.status}` };
    }
    const data = await res.json();
    const item = data.data?.[0];
    if (!item) {
      return { valid: false, bizNumber, mock: false, error: '응답 비어 있음' };
    }
    if (item.b_stt_cd === undefined || item.b_stt === '') {
      return {
        valid: false, bizNumber, mock: false,
        error: '국세청 미등록 사업자번호',
      };
    }
    return {
      valid: item.b_stt_cd === '01', // 01=계속사업자
      bizNumber,
      status: item.b_stt as string,
      statusCode: item.b_stt_cd as string,
      taxType: item.tax_type as string,
      closeDate: item.end_dt ?? null,
      mock: false,
    };
  } catch (err) {
    return {
      valid: false,
      bizNumber,
      mock: false,
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
}
