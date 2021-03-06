import React from 'react'

function Development(props) {
//https://insomenia.com/selections

    const devImpo = [
        {
            languageText : "개발 언어 / 프레임워크",
            language :"React.js",
            serverText : "웹 서버",
            server :"Nginx",
            databaseText : "데이터베이스",
            database :"Postgresql",
            postText : "배포 OS ",
            post :"Ubuntu 20.04",
        },
    ]

    //플랫폼 및 개발언어
    const devDataLanguage = [
        {
            title:"반응형웹",
            subText:"PC와 모바일 브라우져에 대략적인 대응, 인터넷 익스플로러는 대응하지 않습니다",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"하이브리드앱",
            subText:"앱스토어에 출시를 위한 모바일 최적화. 아이폰/안드로이드 패키징, 앱스토어 출시 가이드",
            pay: 4000000,
            Time: 1,
            possible: false,
        },
        {
            title:"노드JS",
            subText:"노드로 개발시 개발 시간이 좀더 소요되지만 개발자 채용/인수인계가 용이합니다",
            pay: 8000000,
            Time: 1,
            possible: false,
        },
    ]
    //구현할 UI 페이지 분량
    const devDataPage = [
        {
            title:"10 페이지 이하",
            subText:"10페이지 이내의 UI 개발",
            pay: 4000000,
            Time: 1,
            possible: true,
        },
        {
            title:"20 페이지 이하",
            subText:"20페이지 이내의 UI 개발",
            pay: 8000000,
            Time: 1,
            possible: true,
        },
        {
            title:"30 페이지 이하",
            subText:"30페이지 이내의 UI 개발",
            pay: 12000000,
            Time: 2,
            possible: true,
        },
        {
            title:"40 페이지 이하",
            subText:"40페이지 이내의 UI 개발",
            pay: 16000000,
            Time: 2,
            possible: true,
        },
        {
            title:"50 페이지 이하",
            subText:"50페이지 이내의 UI 개발",
            pay: 20000000,
            Time: 3,
            possible: true,
        },
    ]
    //디자인
    const devDataDesign = [
        {
            title:"디자인 템플릿을 이용",
            subText:"워드프레스 자체 템플릿을 이용해 개발하고 후반부에 약간만 커스터마이징",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"고객 디자인 간략히 반영",
            subText:"고객사 쪽의 디자인을 구현 효율적인 방식으로 변형해 적용",
            pay: 5000000,
            Time: 1,
            possible: true,
        },
        {
            title:"고객 디자인 세밀히 반영",
            subText:"고객사 쪽의 디자인을 디테일하게 적용",
            pay: 10000000,
            Time: 1,
            possible: true,
        },
        {
            title:"디자인 시안 제작 및 반영",
            subText:"개발자 쪽에서 디자인 시안 작업 후 서비스에 반영",
            pay: 8000000,
            Time: 2,
            possible: true,
        },
    ]
    //업체 기능 구현 / 5개이하 1개월, 6개부터 5개당 1개월 추가
    const devDataTech = [
        {
            title:"주요 데이터 조회/수정/삭제",
            subText:"주요 데이터에 대한 조회/편집/삭제/검색/정렬 기능",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"재고 관리",
            subText:"상품 재고 및 판매 수량 관리",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"상품 관리",
            subText:"업체/판매자가 상품 정보 등록하고 관리하는 기능",
            pay: 1500000,
            Time: 1,
            possible: true,
        },
        {
            title:"주문 관리",
            subText:"업체/판매자가 주문내역을 관리하는 기능",
            pay: 1500000,
            Time: 1,
            possible: true,
        },
        {
            title:"배송 관리",
            subText:"배송 상태 관리 및 송장번호 입력 관리",
            pay: 1500000,
            Time: 1,
            possible: true,
        },
        {
            title:"정산 관리",
            subText:"판매자/업체의 대금 정산을 위해 주별/월별 정산금액 관리(이체는 직접 해야함)",
            pay: 1500000,
            Time: 1,
            possible: true,
        },
        {
            title:"광고 관리",
            subText:"광고 게시물 및 노출 위치 관리, 광고 클릭당 광고 크레딧 차감",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
        {
            title:"예약 관리",
            subText:"예약 가능한 시간을 설정하는 관리 기능",
            pay: 1500000,
            Time: 1,
            possible: true,
        },
        {
            title:"휴일 관리",
            subText:"기본적인 공휴일을 등록하고 추가 휴일을 관리하는 기능",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"모임 관리",
            subText:"모임을 생성하하고 관리하는 기능",
            pay: 1500000,
            Time: 1,
            possible: true,
        },
        {
            title:"일간 통계",
            subText:"일단위로 몇 개의 데이터를 합산해 갯수와 금액을 표시",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"주간 통계",
            subText:"주 단위로 합산한 통계",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"월간 통계",
            subText:"월 단위로 합산한 통계",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"다중 항목에 대한 통계",
            subText:"여러 항목을 선택해 해당 항목에 대한 통계 표시",
            pay: 4000000,
            Time: 1,
            possible: true,
        },
        {
            title:"선택한 날짜에 대한 기간 통계",
            subText:"날짜를 선택해 해당 기간에 해당하는 통계 표시",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
    ]
    //편집/업로드 기능
    const devDataUpload = [
        {
            title:"이지웍 에디터",
            subText:"입력시 볼드, 이탤릭, 폰트 색상 등의 스타일을 적용하는 에디터",
            pay: 500000,
            Time: 1,
            possible: true,
        },
        {
            title:"마크다운 에디터",
            subText:"마크다운 문법으로 글을 작성하고 스타일 적용하는 에디터",
            pay: 500000,
            Time: 1,
            possible: true,
        },
        {
            title:"이미지/파일 첨부",
            subText:"이미지/파일 한개씩 업로드하는 기능",
            pay: 500000,
            Time: 1,
            possible: true,
        },
        {
            title:"여러 이미지 한 번에 첨부",
            subText:"이미지를 갤러리에서 여러 개 선택해서 한 번에 업로드하는 기능",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"유튜브/비메오 영상 임베드",
            subText:"기존 동영상 서비스의 임베드 코드를 삽입하는 방식",
            pay: 500000,
            Time: 1,
            possible: true,
        },
        {
            title:"음성/영상 업로드 재생",
            subText:"음성/영상 업로드시 서버 설정, 스토리지 세팅 등이 필요하고 트래픽 비용이 크게 발생합니다",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
        {
            title:"300메가 이상의 파일 업로드",
            subText:"단순 파일 첨부가 아니라 별도의 업로드 프로세스 처리 필요",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"사용자 멘션(@)",
            subText:"입력창에서 친구나 팔로잉 유저를 자동완성으로 멘션하는 기",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"태그 자동완성",
            subText:"해시태그 등의 자동완성 기능, 자주 입력하는 순서대로 표시 등의 기능",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"단순한 그래프",
            subText:"바차트, 파이차트, 라인차트 등의 그래프를 표시합니다. 그래프 종류나 갯수가 많아지면 비용이 추가됩니다",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"복잡한 그래프",
            subText:"5가지 이상의 그래프가 표시되며 표시하는 데이터의 수가 많은 경우 비용이 커집니다",
            pay: 4000000,
            Time: 1,
            possible: true,
        },
        {
            title:"사진에 상품 정보 태그",
            subText:"사진의 특정 위치에 상품 정보를 태그, 예: 인테리어 사진에 있는 가구에 상품 링크 테그",
            pay: 5000000,
            Time: 1,
            possible: true,
        },
        {
            title:"레이아웃 프레임에 이미지 배치",
            subText:"2~3가지 레이아웃에 맞춰서 이미지나 사진을 배치",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
    ]
    //O2O/커뮤니티 기능 관련
    const devDataCommunity = [
        {
            title:"견적 산출",
            subText:"사용자가 여러 항목을 선택해 견적을 산출하는 기능. 어드민에서 항목을 편집 가능",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
        {
            title:"구인/구직",
            subText:"아르바이트 또는 전문가 구인 구직, 작업 의뢰를 요청하는 등",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"단계별 입력",
            subText:"O2O 서비스에서 카테고리, 지역, 날짜 등 여러 페이지에 걸쳐 순차적으로 입력이 필요할 때",
            pay: 1500000,
            Time: 1,
            possible: true,
        },
        {
            title:"설문",
            subText:"상품 추천 등을 위해 질문을 하는 기능",
            pay: 1500000,
            Time: 1,
            possible: true,
        },
        {
            title:"게시물 피드",
            subText:"인스타그램과 유사한 형태의 게시물 피드 화면",
            pay: 1500000,
            Time: 1,
            possible: true,
        },
        {
            title:"경매/역경매",
            subText:"O2O 서비스에서 전문가가 의뢰 요청에 가격/조건으로 비딩 제안하는 기능",
            pay: 1500000,
            Time: 1,
            possible: true,
        },
        {
            title:"질문/답변",
            subText:"지식인, 스택오버플로우 같은 질문, 답변 기능. 포인트/등급이 들어가면 공수가 커집니다",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"커뮤니티",
            subText:"커뮤니티 그룹 입장 및 그룹 내 게시판, 그룹 내 권한 등의 기능 구현",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
        {
            title:"게이미피케이션 뱃지",
            subText:"사용자의 활동에 따라 뱃지를 부여함, 뱃지를 부여하는 경우의 수가 많아지면 비용 추가",
            pay: 2500000,
            Time: 1,
            possible: true,
        },
        {
            title:"컨텐츠 열람 권한",
            subText:"페트리온이나 해피캠퍼스 처럼 결제/구독으로 권한 확보시 재생/다운로드 권한",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"그룹웨어",
            subText:"프로젝트 별 테스크 등록 및 작업자 설정, 진행 상태 변경 등의 기능",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
        {
            title:"초대",
            subText:"사용자별 초대코드를 생성하고 가입시 입력하면 리워드 지급",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"투표",
            subText:"사용자나 관리자가 등록한 객관식 설문에 투표하고 결과를 그래프 표시",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
    ]
    //고급 기능
    const devDataAdvanced = [
        {
            title:"캘린더 UI 기능",
            subText:"캘린더 상에서 날짜/시간대를 클릭해서 일정을 등록하는 경우, 팝업 등의 복잡도에 따라 비용 추가 가능",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
        {
            title:"지도 위에 팝업 표시",
            subText:"지도 위에 단순 핀이 아닌 요약 정보 팝업을 띄움",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"지도와 목록의 연동",
            subText:"지도 위의 핀들과 검색 결과 목록을 연동",
            pay: 4000000,
            Time: 1,
            possible: true,
        },
        {
            title:"앱 실행시에 현위치 파악",
            subText:"백그라운드가 아닌 앱 실행시에 현재 위치 가져오는 기능",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"리캡차",
            subText:"글 작성 또는 회원가입시 검색봇, 매크로 등을 걸러내는 인증 기능",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"드래그/드롭 위치 저장",
            subText:"테이블이나 부스, 이미지 등을 드래그/드롭으로 배치하고 위치를 저장",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
        {
            title:"전자서명",
            subText:"도장 이미지를 업로드하고 휴대폰/이메일 인증 등을 통해 동의하고 서명하는 프로세스 구축",
            pay: 4000000,
            Time: 1,
            possible: true,
        },
        {
            title:"딥러닝 연동",
            subText:"이미지를 바탕으로 카테고리 자동 추출, 광고글 판별, 자동 매칭 등을 위해 딥러닝을 적용",
            pay: 10000000,
            Time: 1,
            possible: true,
        },
        {
            title:"이미지를 바탕으로 카테고리 자동 추출, 광고글 판별, 자동 매칭 등을 위해 딥러닝을 적용",
            subText:"헥슬란트와 연동해 스마트컨트랙트에 거래 정보를 기록하고 조회",
            pay: 15000000,
            Time: 1,
            possible: true,
        },
        {
            title:"증강현실",
            subText:"증강현실 오픈소스 라이브러리를 활용하여 간단한 증강현실 기능 구현",
            pay: 10000000,
            Time: 1,
            possible: true,
        },
        {
            title:"실시간 음성 채팅",
            subText:"클럽하우스와 같은 음성 채팅/통화를 구현합니다",
            pay: 6000000,
            Time: 1,
            possible: true,
        },
        {
            title:"실시간 화상 채팅",
            subText:"WebRTC 등을 이용해 실시간 화상 채팅/통화를 구현합니다",
            pay: 12000000,
            Time: 1,
            possible: true,
        },
        {
            title:"복잡한 계산 수식",
            subText:"복잡한 계산에 의한 결과값 도출이 필요한 경우",
            pay: 5000000,
            Time: 1,
            possible: true,
        },
    ]
    //서비스를 운영할 서버 플랫폼
    const devDataServer = [
        {
            title:"AWS 클라우드(추천)",
            subText:"2년간 사용할 수 있는 550만 원 AWS 크레딧을 모든 고객사에게 제공합니다",
            pay: 500000,
            Time: 1,
            possible: true,
        },
        {
            title:"기타 환경 세팅",
            subText:"별도의 서버 환경인 경우 문서 파악 및 테스트에 추가적인 개발 소요가 발생합니다",
            pay: 2500000,
            Time: 1,
            possible: true,
        },
    ]
    //회원가입/로그인
    const devDataSign = [
        {
            title:"이메일 가입/로그인",
            subText:"빠르게 구현이 가능합니다. 이메일을 통한 비밀번호 재설정 등의 기능이 포함됩니다",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"휴대폰 인증",
            subText:"가입 페이지에서 휴대폰 인증을 수행해야 가입이 진행되도록 하는 경우",
            pay: 500000,
            Time: 1,
            possible: true,
        },
        {
            title:"실명 인증",
            subText:"실제 본인인지 생년월일과 휴대폰 번호 등을 함께 인증합니다. 가입자 입장에서는 번거롭습니다",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"SNS 웹로그인",
            subText:"카카오, 페이스북, 구글 등의 계정으로 로그인. SNS 로그인 별로 비용이 추가됩니다",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"SNS 모바일로그인",
            subText:"카카오, 페이스북, 구글 등의 계정으로 로그인. SNS 로그인 별로 비용이 추가됩니다",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
        {
            title:"비로그인 구매",
            subText:"로그인 없이 구매, 신청, 참여가 가능해야 하는 경우",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
    ]
    //알림 기능 관련
    const devDataAlarm = [
        {
            title:"개별 푸시 알림",
            subText:"사용자별 디바이스 토큰을 서버에 저장해야 하며 발송 종류가 많을수록 비용이 증가",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"국내 SMS 알림",
            subText:"단문/장문 문자 알림 발송, 다양한 상황에 발송이 되어야 하면 비용이 증가",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"국제 SMS 알림",
            subText:"단문/장문 문자 알림 발송을 해외 사용자 대상으로 발송",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"이메일 알림",
            subText:"알림 발송의 경우의 수가 많거나 발송되는 이메일에 디자인이 필요한 경우 비용이 증가",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"카카오톡 알림",
            subText:"메시지 템플릿의 승인 절차와 테스트 과정이 필요",
            pay: 1500000,
            Time: 1,
            possible: true,
        },
        {
            title:"050 가상번호",
            subText:"수신자의 전화번호를 숨기기 위해 가상 전화번호를 매칭",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"내 알림 내역",
            subText:"친구 초대가 왔거나 내 글에 좋아요가 달렸다는 등의 알림 내역을 표시하는 경우",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
    ]
    //소셜 기능 관련
    const devDataSocial = [
        {
            title:"문의하기",
            subText:"사용자가 남기고 관리자가 확인할 수 있는 문의 기능입니다.",
            pay: 500000,
            Time: 1,
            possible: true,
        },
        {
            title:"1:1 단순 채팅",
            subText:"1:1 사용자간 단순한 텍스트 채팅",
            pay: 4000000,
            Time: 1,
            possible: true,
        },
        {
            title:"복잡한 채팅",
            subText:"다자간 채팅, 채팅 내에 이미지/파일 전송, 작성중 표시, 읽음 표시 등 기능이 고도화되면 비용 추가",
            pay: 10000000,
            Time: 1,
            possible: true,
        },
        {
            title:"팔로잉",
            subText:"회원 간 프로필 페이지를 방문해 팔로우를 하고 내가 팔로우한 사람, 나를 팔로잉한 사람을 볼 수 있습니다",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"웹 공유 기능",
            subText:"웹에서 페이스북, 트위터 공유 기능은 상대적으로 간단합니다",
            pay: 500000,
            Time: 1,
            possible: true,
        },
        {
            title:"앱 공유 기능",
            subText:"앱에서 페이스북, 카카오톡 공유 기능은 네이티브 SNS SDK를 연동해야 사용이 편합니다",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"권한 및 등급 관리",
            subText:"사용자나 관리자별로 메뉴 접근/편집 권한을 분리해야 하는 경우",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"딥링크",
            subText:"공유된 링크 클릭시 앱의 특정 페이지로 이동하거나 앱 미설치시 설치 페이지로 이동",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
    ]
    //네이티브 기능 관련
    const devDataNative = [
        {
            title:"블루투스 연동",
            subText:"블루투스 디바이스와 스마트폰 블루투스를 연결하는 기능입니다.",
            pay: 8000000,
            Time: 1,
            possible: true,
        },
        {
            title:"주소록 연동",
            subText:"스마트폰 주소록 정보를 가져와 팔로잉 추천 등에 활용합니다",
            pay: 8000000,
            Time: 1,
            possible: true,
        },
        {
            title:"QR/바코드 인식",
            subText:"네이티브 QR/바코드 인식 모듈을 이용해 코드를 인식하고 페이지 이동 또는 문자열 인식을 합니다",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
        {
            title:"백그라운드 위치 추적",
            subText:"앱을 활성화하지 않은 상태에서도 현재 위치를 앱 내에서 저장하거나 서버로 전송합니다",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
        {
            title:"보상형 광고 설치 추적",
            subText:"보상형 광고의 리워드 제공을 위해 앱 설치, 광고 조회 등을 추적하기 위해 네이티브 구현이 필요합니다",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
        {
            title:"백그라운드 음성 재생",
            subText:"앱을 실행시킨 상태가 아닐 때에도 음성이 재생되어야 하는 경우 하이브리드앱 방식이 아닌 네이티브 구현이 필요합니다",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
        {
            title:"앱 내에서 외부 웹 표시",
            subText:"외부 웹페이지를 기본 브라우져로 보내지 않고 앱 내에 표시하려면 네이티브로 웹뷰를 추가구현해야 합니다",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
        {
            title:"네이티브 카메라 촬영",
            subText:"카메라 촬영 화면을 커스터마이징하려면 네이티브 코드로 작성해야 함",
            pay: 8000000,
            Time: 1,
            possible: true,
        },
        {
            title:"네이티브 이미지 편집",
            subText:"여러 개의 사진을 순서대로 선택 또는 크롭 편집하기 위해 네이티브 라이브러리 사용",
            pay: 8000000,
            Time: 1,
            possible: true,
        },
        {
            title:"기타 네이티브 SDK 연동",
            subText:"서버 API 호출에 비해 네이티브 SDK 연동의 공수가 큽니다",
            pay: 8000000,
            Time: 1,
            possible: true,
        },
        {
            title:"네이티브 비디오 플레이어",
            subText:"플레이어 화면을 커스텀하는 경우 플레이어를 네이티브에서 구현해야 합니다",
            pay: 10000000,
            Time: 1,
            possible: true,
        },
    ]
    //아이템 목록/상세 관련
    const devDataItem = [
        {
            title:"아이템 목록/상세",
            subText:"아이템 목록 및 상세 페이지는 일반적인 페이지에 비해 복잡도가 높은 편입니다",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"좋아요",
            subText:"아이템에 좋아요 표시해서 마이페이지에서 확인하는 기능",
            pay: 500000,
            Time: 1,
            possible: true,
        },
        {
            title:"북마크",
            subText:"아이템을 북마크해서 마이페이지에서 확인하는 기능",
            pay: 500000,
            Time: 1,
            possible: true,
        },
        {
            title:"찜/북마크 폴더관리",
            subText:"찜이나 북마크를 폴더 단위로 관리하는 기능",
            pay: 1500000,
            Time: 1,
            possible: true,
        },
        {
            title:"댓글",
            subText:"게시물이나 아이템에 댓글 다는 기능이 있을 때",
            pay: 300000,
            Time: 1,
            possible: true,
        },
        {
            title:"대댓글",
            subText:"댓글에 추가로 댓글 다는 기능이 있을 때",
            pay: 500000,
            Time: 1,
            possible: true,
        },
        {
            title:"리뷰/별점",
            subText:"아이템에 별점 리뷰를 다는 기능이 있을 때",
            pay: 500000,
            Time: 1,
            possible: true,
        },
        {
            title:"상품 옵션",
            subText:"아이템 별로 여러 개의 옵션이 존재해 결제시 선택 필요",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"검색",
            subText:"아이템명/설명 검색",
            pay: 500000,
            Time: 1,
            possible: true,
        },
        {
            title:"통합검색",
            subText:"아이템명, 카테고리, 회원 등 통합 검색",
            pay: 1500000,
            Time: 1,
            possible: true,
        },
        {
            title:"최근검색어",
            subText:"사용자가 최근 검색한 검색어를 저장 및 표시",
            pay: 500000,
            Time: 1,
            possible: true,
        },
        {
            title:"인기검색어",
            subText:"사용자들이 많이 검색하는 검색어를 저장 및 표시",
            pay: 500000,
            Time: 1,
            possible: true,
        },
        {
            title:"예약하기",
            subText:"날짜 또는 시간까지 장소 등을 예약을 하는 기능(예약 관리 필요)",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"신고하기",
            subText:"게시물 또는 사용자를 신고하는 기능(애플 앱스토어 출시를 위해선 필수",
            pay: 500000,
            Time: 1,
            possible: true,
        },
        {
            title:"랭킹",
            subText:"조회수, 찜수 등을 전체, 월간, 일간으로 합산하여 순위대로 표시하는 기능",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"추천/유사한 아이템",
            subText:"특정 아이템과 연관된 아이템을 표시하는 로직이 복잡하면 비용이 추가될 수 있습니다",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"상세조건 필터링",
            subText:"아이템 가격, 카테고리, 기타 부가 정보를 바탕으로 필터링하는 기능이 있는 경우",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"거리순 필터링/정렬",
            subText:"주소/좌표 기준으로 가까운 순으로 정렬/필터링하는 기능",
            pay: 500000,
            Time: 1,
            possible: true,
        },
    ]
    //결제관련
    const devDataPayment = [
        {
            title:"국내카드 결제",
            subText:"이니시스, 나이스 등의 국내 PG사를 통해 카드 결제를 연동하는 방식입니다",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"가상계좌 결제",
            subText:"가상계좌의 경우 주문완료와 결제완료가 분리되어 있어 관리자/사용자 주문내역이 복잡해집니다",
            pay: 4000000,
            Time: 1,
            possible: true,
        },
        {
            title:"페이팔/해외카드 결제",
            subText:"페이팔을 연동하면 해외 신용카드와 페이팔 결제를 할 수 있습니다. 국내 사용자는 결제가 불가능합니다",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"실시간계좌/휴대폰 결제",
            subText:"이니시스, 나이스 등의 국내 PG사를 통해 카드 결제를 연동하는 방식입니다",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"적립금/포인트 제도",
            subText:"적립급의 만료일 기준이 있거나 적립금 차감들을 모두 로깅해야 하면 비용이 증가할 수 있습니다",
            pay: 1500000,
            Time: 1,
            possible: true,
        },
        {
            title:"쿠폰 결제",
            subText:"배송비 쿠폰, 금액 쿠폰, 퍼센트 쿠폰 등 다양한 쿠폰 정책을 적용하게 됩니다",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"정기/구매시 자동 결제",
            subText:"카드 번호를 입력한 뒤 매월 또는 구매시 자동으로 결제",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
        {
            title:"인앱 결제",
            subText:"디지털 컨텐츠의 경우 아이폰/안드로이드에서 인앱결제로 구현해야 출시가 가능한 경우가 있습니다",
            pay: 5000000,
            Time: 1,
            possible: true,
        },
        {
            title:"판매자 지급대행",
            subText:"판매 대금 정산을 결제사에서 대행하도록 구현하는 경우. PG사 승인이 나지 않을 수도 있습니다",
            pay: 5000000,
            Time: 1,
            possible: true,
        },
        {
            title:"장바구니 기능",
            subText:"이니시스, 나이스 등의 국내 PG사를 통해 카드 결제를 연동하는 방식입니다",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"구매자 결제 취소",
            subText:"구매자 결제 취소 기능은 조건이 복잡해 관리자 결제 취소와 비교해 공수가 큽니다",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"아임포트 없이 결제 구축",
            subText:"아임포트를 통하지 않고 직접 결제사와 계약을 하시는 경우 구현 공수가 크게 듭니다",
            pay: 8000000,
            Time: 1,
            possible: true,
        },
    ]
    //외부 API 및 크롤링 관련
    const devDataApi = [
        {
            title:"단순한 API 연동",
            subText:"요청 건수가 작고 호출시 주고 받는 데이터가 단순한 경우",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"복잡한 API 연동",
            subText:"인증 절차가 있고 주고 받는 데이터가 복잡한 경우",
            pay: 5000000,
            Time: 1,
            possible: true,
        },
        {
            title:"주기적인 데이터 처리/알림",
            subText:"주기적으로 API처리 또는 메시지 발송이 필요한 경우",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"백그라운드 처리",
            subText:"대용량 업로드, 통계처리 등 시간이 걸리는 작업을 백그라운드 처리",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"서버 크롤링",
            subText:"수집 대상이 크롤링 서버 IP를 블락하거나 크롤링 페이지의 복잡도가 높은 경우 비용 추가 가능",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
        {
            title:"브라우져 스크래핑",
            subText:"리액트 등의 프론트엔드 프레임워크가 쓰여 서버 to 서버 크롤링이 불가능한 경우",
            pay: 5000000,
            Time: 1,
            possible: true,
        },
    ]
    //문서 추출 관련
    const devDataDoc = [
        {
            title:"PDF 자동 출력",
            subText:"제목, 단락, 표 등 양식이 있는 PDF를 만들어내는 경우",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"간단한 액셀 임포트/익스포트",
            subText:"엑셀로 데이터를 등록하거나 내려받는 기능, 3종류 이하의 액셀",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"복잡한 액셀 임포트/익스포트",
            subText:"액셀로 데이터를 등록하거나 내려받는 기능, 4종류 이상의 액셀",
            pay: 4000000,
            Time: 1,
            possible: true,
        },
    ]
    //국제화 관련
    const devDataWorld = [
        {
            title:"메뉴명 다국어 처리",
            subText:"데이터베이스는 다국어를 고려하지 않고 메뉴명 및 사이트 문구만 다국어로 처리합니다",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
        {
            title:"게시물 데이터 다국어 처리",
            subText:"메뉴명/문구 뿐만 아니라 공지사항이나 게시판 등을 언어별로 분리하여 관리합니다",
            pay: 5000000,
            Time: 1,
            possible: true,
        },
        {
            title:"사용자 국가별 타임존 적용",
            subText:"다양한 국가의 사용자 대상이여서 각 사용자의 타임존 설정이 필요한 경우",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
    ]
    //기타
    const devDataEtc = [
        {
            title:"코드 주석 작업",
            subText:"프레임워크 특성상 주석 없이도 이해가 쉽지만 필요한 경우 주석 정리를 해드립니다",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"기존 데이터 이전",
            subText:"기존 서비스의 데이터베이스를 새 플랫폼에 이전해야 하는 경우(이전이 불가능한 경우도 있음)",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"테스트코드 작성",
            subText:"몇 가지 핵심 로직에 대한 테스트 코드 작성이 필요한 경우",
            pay: 2000000,
            Time: 1,
            possible: true,
        },
        {
            title:"개발자의 중간 검수 강화",
            subText:"고객사가 검수하실 부분이 줄어들도록 개발자가 좀더 꼼꼼히 검수합니다",
            pay: 5000000,
            Time: 1,
            possible: true,
        },
        {
            title:"반응형웹 SEO 기초",
            subText:"React웹의 meta 태그를 동적으로 관리하여 구글에서 검색되게 합니다",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"반응형웹 SEO 응용",
            subText:"구글, 카카오, 네이버 등 몇 개 검색엔진에서 검색되도록 처리(최적화할수록 비용 추가)",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
        {
            title:"반응형웹 SEO 심화",
            subText:"React웹의 서버사이드렌더링 처리를 통해 모든 검색엔진에서 검색되게 합니다",
            pay: 5000000,
            Time: 1,
            possible: true,
        },
        {
            title:"구글 애널리틱스 기초",
            subText:"스크립트 탑재 및 한두개 핵심 이벤트만 호출",
            pay: 1000000,
            Time: 1,
            possible: true,
        },
        {
            title:"구글 애널리틱스 응용",
            subText:"주요 이벤트 및 아이템별 로그 기록, 이벤트/아이템이 많아질 수록 비용 추가",
            pay: 3000000,
            Time: 1,
            possible: true,
        },
    ]

    return (
        <div>
            현재 개발중입니다.
        </div>
    )
}

export default Development
