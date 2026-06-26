# 카카오 알림톡 템플릿 등록서 (알리고/카카오 비즈메시지 심사용)

> 이 문서는 [src/lib/notifications/kakao-templates.ts](../src/lib/notifications/kakao-templates.ts) 와 1:1 일치합니다.
> **콘솔 등록 문구는 아래 "본문"을 글자 그대로 복사**하세요. 코드가 발송하는 문구도 동일 소스에서 나오므로
> "등록본 ≠ 발송본"으로 반려되지 않습니다. 변수는 카카오 규격 `#{변수명}` 입니다.
>
> 발신프로필: (주)홍지 카카오 비즈니스 채널 / 강조유형: 기본형 / 메시지유형: 기본 알림

---

## 1. ORDER_CREATED — 신규 주문 접수(관리자)
- **변수:** `#{company_name}`, `#{order_number}`, `#{item_summary}`, `#{requested_date}`
- **버튼:** [웹링크] 주문 관리 → `{APP_URL}/admin/orders`

```
[OMWIS] 신규 주문 접수

거래처: #{company_name}
주문번호: #{order_number}
품목: #{item_summary}
납기 요청일: #{requested_date}

주문 관리에서 승인/거절을 진행해 주세요.
```

## 2. ORDER_APPROVED — 주문 승인(거래처)
- **변수:** `#{order_number}`, `#{confirmed_date}`
- **버튼:** [웹링크] 주문 내역 보기 → `{APP_URL}/customer/orders`

```
[(주)홍지] 주문 승인 안내

주문번호: #{order_number}
주문이 정상 승인되었습니다.
예상 납기일: #{confirmed_date}

자세한 내용은 주문 내역에서 확인하실 수 있습니다.
```

## 3. ORDER_REJECTED — 주문 거절(거래처)
- **변수:** `#{order_number}`, `#{reason}`
- **버튼:** [웹링크] 주문 내역 보기 → `{APP_URL}/customer/orders`

```
[(주)홍지] 주문 처리 안내

주문번호: #{order_number}
아래 사유로 주문이 처리되지 못했습니다.
사유: #{reason}

문의사항은 담당자에게 연락 부탁드립니다.
```

## 4. DELIVERY_DEPART — 배송 출발(거래처)
- **변수:** `#{order_number}`, `#{address}`
- **버튼:** [웹링크] 주문 내역 보기 → `{APP_URL}/customer/orders`

```
[(주)홍지] 배송 출발 안내

주문번호: #{order_number}
주문하신 상품이 배송 출발하였습니다.
배송지: #{address}
```

## 5. DELIVERY_DONE — 배송 완료(거래처)
- **변수:** `#{order_number}`
- **버튼:** [웹링크] 주문 내역 보기 → `{APP_URL}/customer/orders`

```
[(주)홍지] 배송 완료 안내

주문번호: #{order_number}
주문하신 상품이 배송 완료되었습니다.
이용해 주셔서 감사합니다.
```

---

## 등록 절차 체크리스트
1. 알리고 콘솔 → 알림톡 → 템플릿 등록에서 위 5개를 **코드명(영문 대문자)** 그대로 등록
2. 각 템플릿의 변수 `#{...}` 와 버튼(웹링크 URL)을 동일하게 입력
3. `{APP_URL}` 은 실제 배포 도메인으로 치환 (예: `https://omwis.hongi.co.kr`)
   - 코드에서는 `NEXT_PUBLIC_APP_URL` 환경변수로 자동 주입됨
4. 카카오 심사 통과(1~2 영업일) 후 `.env.local` 의 알리고 4개 키 입력 → 자동 실발송 전환
5. 변수/문구를 바꾸면 **카카오 재심사 대상** — 반드시 `kakao-templates.ts` 와 본 문서를 함께 수정
