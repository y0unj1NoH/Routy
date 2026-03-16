export const UI_COPY = {
  // Shared messages reused across authenticated pages, forms, and generic fallbacks.
  common: {
    loading: {
      // Shown while auth/session state is being restored before protected pages render.
      authCheck: "로그인 확인 중",
      // Default loading label used by `LoadingPanel` when no page-specific message is passed.
      default: "불러오는 중"
    },
    error: {
      // Generic fallback when technical server details should stay out of the UI.
      serviceUnavailableTitle: "서비스를 불러오지 못했어요",
      serviceUnavailableDescription: "잠시 후 다시 시도해 주세요",
      invalidInput: "입력값을 확인해 주세요"
    },
    action: {
      // Common CTA labels reused by dialogs and error states.
      close: "닫기",
      cancel: "취소",
      back: "뒤로가기",
      retry: "다시 시도",
      restore: "복원",
      goToLogin: "로그인으로 이동"
    },
    deleteConfirm: {
      title: "삭제를 진행할까요?",
      description: "삭제하면 관련 메모와 표시가 함께 사라지고 다시 되돌릴 수 없어요",
      confirm: "삭제",
      confirming: "삭제 중",
      cancel: "취소"
    },
    form: {
      // Shared validation copy for auth and import forms.
      validEmail: "유효한 이메일을 입력해 주세요",
      passwordMin: "비밀번호는 최소 6자 이상이어야 해요",
      confirmPassword: "비밀번호를 다시 입력해 주세요",
      passwordMismatch: "비밀번호가 일치하지 않아요",
      listNameRequired: "리스트 이름을 입력해 주세요",
      listNameMax: "리스트 이름은 12자 이내로 입력해 주세요",
      cityRequired: "도시를 입력해 주세요",
      cityMax: "도시는 12자 이내로 입력해 주세요",
      googleMapsUrlRequired: "Google Maps 링크를 입력해 주세요",
      validUrl: "올바른 URL을 입력해 주세요"
    }
  },

  // Labels used in the fixed bottom navigation.
  navigation: {
    bottomNav: {
      home: "내 일정",
      saved: "저장 리스트",
      newRoute: "새 일정",
      my: "마이"
    }
  },

  // Relative trip status badges used by `format.ts` on home/mypage cards.
  scheduleStatus: {
    invalid: "일정 정보를 확인해 주세요",
    pastTripByEndDays: (elapsedDays: number) => `${elapsedDays}일 전에 다녀온 일정`,
    todayDeparture: "오늘 떠나는 여행이에요",
    ongoing: "지금 여행 중이에요",
    startedDaysAgo: (elapsedDays: number) => `${elapsedDays}일 전에 시작된 여행`,
    startingToday: "오늘 시작하는 여행이에요",
    upcomingSoon: "여행이 곧 시작돼요",
    upcomingInDays: (diffDays: number) => `${diffDays}일 뒤에 떠나요`
  },

  // Opening-hour summaries used on place cards and place detail pages.
  placeOpening: {
    noInfo: "영업시간 정보 없음",
    closed: "영업 종료",
    closingSoon: "곧 마감",
    closingInMinutes: (minutes: number) => `${minutes}분 후 마감`,
    open: "영업 중"
  },

  // Authentication copy for `/login`, `/signup`, `/auth/callback`, and auth-error mapping.
  auth: {
    // Generic service issue shown instead of exposing Supabase/provider setup details.
    serviceConfigError: "서비스 설정에 문제가 있어요. 잠시 후 다시 시도해 주세요",
    error: {
      signInProblem: "로그인 중 문제가 발생했어요",
      signUpProblem: "회원가입 중 문제가 발생했어요",
      invalidCredentials: "이메일 또는 비밀번호가 맞지 않아요",
      emailNotConfirmed: "이메일 인증이 필요해요",
      tooManyRequests: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요",
      signInFailed: "로그인에 실패했어요",
      signUpFailed: "회원가입에 실패했어요",
      googleFailed: "Google 로그인에 실패했어요",
      callbackFailed: "로그인에 실패했어요. 다시 시도해 주세요",
      alreadyRegistered: "이미 가입된 이메일이에요",
      signInGeneric: "로그인 중 오류가 발생했어요",
      signUpGeneric: "회원가입 중 오류가 발생했어요"
    },
    login: {
      // `/login` form title and actions.
      title: "로그인",
      emailLabel: "이메일",
      passwordLabel: "비밀번호",
      rememberLabel: "로그인 유지",
      rememberDescription: "기본은 브라우저를 닫으면 로그아웃돼요. 이 기기에서 계속 쓰려면 체크해 주세요",
      submit: "로그인",
      submitting: "로그인하는 중",
      google: "Google 계정으로 로그인",
      success: "로그인했어요",
      prompt: "계정이 없으신가요?",
      promptAction: "회원가입"
    },
    signup: {
      // `/signup` form title and actions.
      title: "회원가입",
      emailLabel: "이메일",
      passwordLabel: "비밀번호",
      confirmPasswordLabel: "비밀번호 확인",
      submit: "회원가입",
      submitting: "가입하는 중",
      success: "회원가입이 완료됐어요. 로그인해주세요",
      prompt: "이미 계정이 있으신가요?",
      promptAction: "로그인"
    },
    callback: {
      // `/auth/callback` loading and failure copy.
      loading: "로그인 처리 중"
    }
  },

  // Shared modal copy for importing Google Maps saved lists from `/saved` and `/routes/new`.
  importListModal: {
    title: "저장 리스트 가져오기",
    description: "Google Maps 저장 리스트 링크를 붙여넣고 리스트 이름과 도시를 확인해 주세요",
    success: "리스트를 가져왔어요",
    error: "리스트를 가져오지 못했어요",
    submit: "리스트 가져오기",
    submitting: "가져오는 중",
    close: "취소",
    loading: "저장 리스트를 가져오는 중",
    loadingHint: "장소가 많을수록 시간이 조금 더 걸릴 수 있어요. 잠시만 기다려 주세요",
    labels: {
      url: "Google Maps 저장 리스트 링크",
      listName: "리스트 이름",
      city: "도시 이름"
    },
    placeholders: {
      url: "https://maps.app.goo.gl/저장리스트링크",
      listName: "예: 방콕 3박 4일",
      city: "예: 방콕"
    },
    hints: {
      listName: "비워두면 도시 이름으로 저장돼요"
    }
  },

  // Home header and empty/error states for `/` and `/empty`.
  home: {
    header: {
      title: "내 일정",
      subtitle: "다가오는 여행만 먼저 보여드려요"
    },
    loading: {
      schedules: "일정 목록 불러오는 중"
    },
    error: {
      sessionExpiredTitle: "로그인 세션이 만료되었습니다",
      sessionExpiredDescription: "다시 로그인한 뒤 일정을 불러와 주세요"
    },
    empty: {
      title: "아직 만든 일정이 없어요",
      description: "다음 여행을 기다리고 있어요",
      action: "일정 만들기"
    },
    pastOnly: {
      title: "다가오는 일정이 없어요",
      description: (count: number) => `지난 일정 ${count}개는 마이페이지의 여행 캘린더에서 다시 볼 수 있어요`,
      createAction: "일정 만들기",
      calendarAction: "여행 캘린더 보기"
    },
    otherSchedulesLabel: "다른 일정"
  },

  // Saved-list index/detail/place-detail copy for `/saved` flows.
  saved: {
    index: {
      loading: "저장 리스트 불러오는 중",
      title: "내 저장 리스트",
      subtitle: "가고 싶은 장소를 모아두세요",
      addAction: "추가하기",
      errorTitle: "저장 리스트를 불러오지 못했어요",
      errorDescription: "잠시 후 다시 시도해 주세요",
      emptyTitle: "아직 저장한 리스트가 없어요",
      emptyDescription: "가고 싶은 장소를 리스트로 모아 보세요",
      emptyAction: "저장 리스트 가져오기",
      listCount: (itemCount: number) => `${itemCount}개의 장소`,
      listDescription: (city: string, itemCount: number) => `${city} · ${itemCount}개 장소`
    },
    detail: {
      loading: "리스트 불러오는 중",
      notFoundTitle: "리스트를 찾을 수 없어요",
      notFoundDescription: "리스트를 찾을 수 없어요. 다시 확인해 주세요",
      listSubtitle: (city: string, itemCount: number) => `${city} · ${itemCount}개 장소`,
      updateSuccess: "리스트 정보를 업데이트했어요",
      updateError: "리스트 업데이트에 실패했어요",
      noteError: "메모를 저장하지 못했어요",
      removePlaceSuccess: "장소를 리스트에서 삭제했어요",
      removePlaceError: "장소를 삭제하지 못했어요",
      mustVisitError: "Must Visit 표시에 실패했어요",
      deleteSuccess: "리스트를 삭제했어요",
      deleteError: "리스트 삭제에 실패했어요",
      addPlaceNotFound: "장소를 찾지 못했어요. 링크를 확인해 주세요",
      addPlaceSuccess: (importedCount: number, primaryPlaceName: string) =>
        importedCount > 1 ? `${importedCount}개 장소를 이 리스트에 추가했어요` : `${primaryPlaceName}를 리스트에 추가했어요`,
      addPlaceError: "장소 추가에 실패했어요",
      headerActions: {
        editList: "리스트 편집",
        addPlace: "링크로 장소 추가",
        deleteList: "리스트 삭제"
      },
      headerEditor: {
        save: "저장",
        saving: "저장 중"
      },
      placesSection: {
        title: "저장한 장소",
        description: "Must Visit 표시와 메모를 정리해 보세요",
        emptyTitle: "리스트가 비어 있어요",
        emptyDescription: "Google Maps 링크로 장소를 추가해 보세요",
        placeFallback: "이름 없는 장소",
        addressFallback: "주소 없음",
        notePlaceholder: "메모를 입력해 주세요",
        mustVisitBadge: "Must Visit",
        detailAction: "장소 상세"
      },
      addPlaceModal: {
        title: "이 리스트에 장소 추가",
        description: "Google Maps 장소 링크를 붙여넣어 현재 리스트에 넣을 장소를 불러와요",
        label: "Google Maps 장소 링크",
        placeholder: "https://maps.app.goo.gl/장소링크",
        submit: "장소 추가",
        submitting: "추가 중"
      },
      deleteDialog: {
        title: "삭제를 진행할까요?",
        description: "삭제하면 관련 메모와 표시가 함께 사라지고 다시 되돌릴 수 없어요",
        confirm: "삭제",
        confirming: "삭제 중",
        cancel: "취소"
      },
      placeDeleteDialog: {
        title: (_placeName: string) => "삭제를 진행할까요?",
        description: "삭제하면 관련 메모와 표시가 함께 사라지고 다시 되돌릴 수 없어요",
        confirm: "삭제",
        confirming: "삭제 중",
        cancel: "취소"
      }
    },
    placeDetail: {
      loading: "장소 정보 불러오는 중",
      notFoundTitle: "장소를 찾을 수 없어요",
      savedDescription: "리스트에서 다시 선택해 주세요",
      directDescription: "다른 장소를 선택해 주세요",
      backToList: "리스트로 돌아가기"
    }
  },

  // Copy for `/routes/import`, `/routes/new`, `/routes/recommendation`, `/routes/[id]`, and route stop cards.
  routes: {
    import: {
      loading: {
        lists: "리스트를 가져오는 중",
        listHint: "장소가 많을수록 시간이 조금 더 걸릴 수 있어요. 잠시만 기다려 주세요",
        places: "장소 가져오는 중"
      },
      title: "리스트 가져오기",
      subtitle: "Google Maps 링크로 장소를 가져올 수 있어요",
      crawlerSection: {
        title: "리스트 가져오기",
        description: "리스트 URL을 입력하면 장소를 한 번에 가져와요",
        submit: "리스트 가져오기",
        submitting: "가져오는 중",
        openDetail: "가져온 리스트 상세로 이동"
      },
      googleSection: {
        title: "Google 지도 링크로 장소 가져오기",
        description: "장소 링크를 입력하면 장소 정보를 가져와요",
        placeholder: "Google Maps 장소 링크",
        submit: "장소 가져오기",
        submitting: "가져오는 중",
        importedCount: (count: number) => `최근 가져온 장소 수: ${count}`
      },
      recentPlaces: {
        title: "최근 가져온 장소",
        description: "가져온 장소를 바로 확인할 수 있어요",
        placeFallback: "이름 없는 장소",
        addressFallback: "주소 정보 없음",
        detailAction: "장소 상세 보기"
      },
      toast: {
        importListSuccess: "리스트를 가져왔어요",
        importListError: "리스트를 가져오지 못했어요",
        importPlacesSuccess: (count: number) => `${count}개 장소를 가져왔어요`,
        importPlacesError: "장소를 가져오지 못했어요"
      }
    },
    new: {
      loading: {
        lists: "리스트 불러오는 중",
        buildingSchedule: "맞춤 여행 일정 만드는 중"
      },
      toast: {
        success: "일정을 만들었어요",
        error: "일정을 만들지 못했어요",
        missingSelection: "리스트와 여행 날짜를 먼저 선택해 주세요",
        importedListSelected: (listName: string) => `${listName} 리스트를 불러왔어요`
      },
      titleFallback: "새 여행 일정",
      listStep: {
        title: "어떤 여행 리스트를 불러올까요?",
        description: "리스트를 기반으로 여행 코스를 추천해 드려요",
        addAction: "새 리스트 가져오기",
        emptyTitle: "불러올 리스트가 없어요",
        emptyDescription: "리스트가 없어요. 새 리스트를 먼저 가져와 주세요",
        listCount: (count: number) => `${count}개의 장소`,
        helperAction: "원하는 리스트가 없나요? 새 리스트 가져오기",
        next: "다음"
      },
      dateStep: {
        title: "언제 떠날까요?",
        description: "여행 날짜를 선택해 주세요",
        dayNames: ["일", "월", "화", "수", "목", "금", "토"],
        unselectedDate: "날짜 미선택",
        invalidRange: "종료일은 시작일보다 빠를 수 없어요",
        maxDurationHint: (days: number) => `여행 기간은 최대 ${days}일까지 선택할 수 있어요`,
        maxDurationError: (days: number) => `여행 기간은 최대 ${days}일까지 선택할 수 있어요`,
        previous: "이전",
        next: "다음"
      },
      stayStep: {
        title: "예약한 숙소가 있나요?",
        description: "숙소가 있으면 반영하고, 없으면 추천 위치를 알려드릴게요",
        bookedOption: "네, 정해졌어요",
        unbookedOption: "아직 안 정했어요",
        bookedOptionDescription: "예약한 숙소를 바로 고를 수 있어요",
        unbookedOptionDescription: "일정을 만들고, 숙소 추천 위치를 알려드릴게요",
        bookedTitle: "예약한 숙소가 있다면 선택해 주세요",
        bookedDescription: "리스트에 담아둔 숙소만 보여드릴게요",
        unbookedTitle: "일정이 나온 뒤에 정해도 괜찮아요",
        unbookedDescription: "일정을 먼저 만든 뒤에 숙소 잡기 좋은 위치를 알려드릴게요",
        helperTitle: "찾는 숙소가 없나요?",
        helperDescription: "지금 Google 링크로 추가해서 바로 선택할 수 있어요",
        addAction: "Google 링크로 숙소 추가",
        unbookedSteps: [
          "저장한 장소로 먼저 일정을 만들어요",
          "동선이 겹치는 중심 구역을 찾아요",
          "숙소 잡기 좋은 범위를 지도에서 보여드려요"
        ],
        previous: "이전",
        next: "다음"
      },
      companionsStep: {
        title: "누구와 함께 떠나시나요?",
        description: "동행에 맞는 코스를 추천해 드려요",
        options: [
          { label: "나 홀로 여행", value: "SOLO" },
          { label: "친구와 함께", value: "FRIENDS" },
          { label: "연인과 로맨틱하게", value: "COUPLE" },
          { label: "가족과 오붓하게", value: "FAMILY" },
          { label: "여럿이 북적북적", value: "GROUP" }
        ],
        previous: "이전",
        next: "다음"
      },
      styleStep: {
        title: "어떤 여행을 원하시나요?",
        description: "취향에 맞는 여행 코스를 추천해 드려요",
        paceLabel: "여행 페이스",
        required: "* 필수",
        themeLabel: "이번 여행에서 가장 기대하는 건?",
        optional: "선택",
        previous: "이전",
        submit: "AI 추천 일정 생성",
        paceOptions: [
          { label: "알차게", caption: "하루 5곳 안팎으로 꽉 채워요", value: "INTENSE" },
          { label: "느긋하게", caption: "하루 3곳 안팎으로 여유 있게 둘러봐요", value: "RELAXED" },
          { label: "적당히", caption: "하루 4곳 안팎으로 균형 있게 추천해요", value: "MODERATE" }
        ],
        themeOptions: [
          { title: "식도락이 1순위", subtitle: "맛집부터 로컬 간식까지, 먹는 게 남는 것!", value: "FOODIE" },
          { title: "대표 명소 정복", subtitle: "\"거긴 꼭 가야지\" 소리 듣는 랜드마크 필수", value: "LANDMARK" },
          { title: "취향 가득 쇼핑", subtitle: "편집숍부터 로컬 마켓까지, 득템의 시간", value: "SHOPPING" },
          { title: "자연 속에서 힐링", subtitle: "답답한 도시를 벗어나 자연과 가까워지는 곳", value: "NATURE" }
        ]
      }
    },
    recommendation: {
      loading: {
        checking: "일정 정보 확인 중",
        preparing: "AI 추천 일정 준비 중"
      },
      toast: {
        regenerateSuccess: "새 AI 추천 일정으로 업데이트했어요",
        regenerateError: "일정 재추천에 실패했어요"
      },
      createError: {
        title: "일정을 만들지 못했어요",
        description: "입력값을 확인하거나 잠시 후 다시 시도해 주세요",
        action: "다시 생성하기"
      },
      missingSchedule: {
        title: "생성된 일정을 찾을 수 없어요",
        description: "다시 생성해 주세요",
        action: "새 일정 만들기"
      },
      fetchError: {
        title: "추천 일정을 불러오지 못했어요",
        description: "잠시 후 다시 시도해 주세요",
        action: "다시 불러오기"
      },
      readyTitle: "AI 추천 일정이 준비됐어요",
      heroTitle: (city: string | null | undefined) => (city ? `${city} 여행 코스가 나왔어요` : "여행 코스가 나왔어요"),
      heroDescription: "이렇게 떠나보는 건 어떠신가요?",
      actionDescription: "추천 결과가 마음에 들면 상세 일정으로 이어서 볼 수 있어요",
      previewTitle: "추천 결과 미리보기",
      previewSummary: (count: number) => `${count}일 일정 요약`,
      previewDays: (count: number) => `${count}일 일정`,
      confirmAction: "내 일정으로 담기",
      regenerateAction: "새 추천받기",
      stopFallback: "추천 장소가 없어요",
      stopCount: (count: number) => `${count}개 장소`
    },
    detail: {
      loading: "일정을 불러오는 중",
      notFoundTitle: "일정을 찾을 수 없어요",
      notFoundDescription: "목록에서 다시 선택해 주세요",
      emptyDay: "이 날짜에는 아직 등록된 장소가 없어요",
      travelModes: {
        transit: "대중교통",
        walk: "도보",
        subway: "지하철"
      },
      splitView: "지도 + 일정",
      listView: "일정만",
      deleteAction: "삭제",
      toast: {
        deleteSuccess: "일정을 삭제했어요",
        deleteError: "일정을 삭제하지 못했어요",
        noteError: "메모를 저장하지 못했어요"
      },
      travelToNext: (modeLabel: string, durationLabel: string) => `다음 장소까지 ${modeLabel} ${durationLabel}`,
      deleteDialog: {
        title: "삭제를 진행할까요?",
        description: "삭제하면 관련 메모와 표시가 함께 사라지고 다시 되돌릴 수 없어요",
        confirm: "삭제",
        confirming: "삭제 중",
        cancel: "취소"
      }
    },
    stopCard: {
      placeFallback: "이름 없는 장소",
      noteTitle: "메모",
      noteDescription: "기억해둘 게 있다면 가볍게 메모해 보세요",
      notePlaceholder: "예: 점심 예약, 비 오면 건너뛰기",
      edit: "수정",
      delete: "삭제",
      cancel: "취소",
      save: "메모 저장",
      saving: "저장 중",
      foldNote: "메모 접기",
      editNote: "메모 수정",
      addNote: "메모 추가",
      mapAction: "지도 보기",
      placeInfoAction: "장소 정보"
    }
  },

  // Place detail copy used by `/places/[placeId]` and `/saved/[listId]/[placeId]`.
  places: {
    detail: {
      title: "장소 정보",
      categoryLabels: {
        LANDMARK: "명소",
        FOODIE: "맛집",
        SHOPPING: "쇼핑"
      },
      typeLabels: {
        tourist_attraction: "관광 명소",
        museum: "박물관",
        art_gallery: "미술관",
        park: "공원",
        hotel: "호텔",
        lodging: "숙소",
        restaurant: "레스토랑",
        cafe: "카페",
        bar: "바",
        bakery: "베이커리",
        meal_takeaway: "테이크아웃",
        shopping_mall: "쇼핑몰",
        department_store: "백화점",
        store: "매장",
        point_of_interest: "관심 장소",
        establishment: "일반 장소",
        temple: "사원",
        night_club: "나이트라이프"
      },
      placeQueryFallback: "장소 정보",
      placeFallback: "이름 없는 장소",
      addressFallback: "주소 정보 없음",
      reviewFallback: "리뷰 없음",
      reviewCount: (count: number) => `리뷰 ${new Intl.NumberFormat("ko-KR").format(count)}개`,
      priceUnknown: "가격 정보 없음",
      free: "무료",
      priceLabels: ["", "저렴", "보통", "비싼 편", "프리미엄"],
      overviewCategoryFallback: "여행 장소",
      overviewRating: (rating: string, reviewCount: string) => `평점 ${rating} · 리뷰 ${reviewCount}`,
      overviewRatingFallback: "아직 리뷰가 충분하지 않아요",
      overviewSentence: (category: string, ratingText: string) => `${category} 카테고리에 속한 장소예요. ${ratingText}`,
      actions: {
        directions: "길찾기",
        directionsSub: "Google Maps",
        moreReviews: "리뷰 더 보기",
        moreReviewsSub: "리뷰 원문 확인",
        phone: "전화",
        website: "웹사이트",
        websiteSub: "공식 링크"
      },
      stats: {
        rating: "평점",
        reviewCount: "리뷰 수",
        priceLevel: "가격대",
        openingStatus: "영업 상태",
        googlePlaces: "Google Places 기준",
        missingRating: "평점 데이터 없음"
      },
      photos: {
        title: "사진",
        description: "장소 분위기를 확인할 수 있는 사진이에요",
        count: (count: number) => `${count}장`
      },
      openingHours: {
        title: "영업시간",
        description: "방문 가능 시간을 확인해 보세요",
        empty: "영업시간 정보가 없어요. Google Maps에서 확인해 보세요"
      },
      reviews: {
        title: "리뷰 요약",
        description: "최근 리뷰를 통해 분위기를 확인해 보세요",
        anonymous: "익명 사용자",
        missingDate: "작성일 정보 없음",
        missingText: "리뷰 내용이 없어요",
        empty: "리뷰가 아직 없어요"
      },
      map: {
        eyebrow: "지도",
        title: "위치 확인",
        openInGoogleMaps: "Google Maps에서 열기",
        description: "지도에서 위치를 바로 확인할 수 있어요"
      },
      quickInfo: {
        eyebrow: "정보",
        title: "빠른 정보",
        address: "주소",
        phone: "전화",
        website: "웹사이트",
        priceLevel: "가격대",
        updatedAt: "최근 업데이트",
        phoneFallback: "전화번호 없음",
        websiteAction: "공식 링크 열기",
        websiteFallback: "웹사이트 정보 없음"
      }
    }
  },

  // My page headings, calendar labels, summary cards, and account/settings copy.
  mypage: {
    loading: {
      page: "마이페이지 불러오는 중",
      history: "여행 기록 불러오는 중"
    },
    error: {
      title: "마이페이지를 불러오지 못했어요",
      description: "잠시 후 다시 시도해 주세요"
    },
    title: "마이페이지",
    subtitle: "다가올 여행과 지난 여행을 한눈에 확인할 수 있어요",
    nextTripEyebrow: "next trip",
    weekdayLabels: ["일", "월", "화", "수", "목", "금", "토"],
    summaryCards: {
      totalSchedules: { label: "전체 일정", hint: "지금까지 만든 여행 일정" },
      upcomingSchedules: { label: "다가오는 일정", hint: "출발 전이거나 진행 중인 여행" },
      savedLists: { label: "저장 리스트", hint: "도시별로 모아 둔 여행 장소" },
      savedPlaces: { label: "저장 장소", hint: "리스트에 담아 둔 전체 장소" }
    },
    calendarSection: {
      title: "여행 캘린더",
      description: "날짜를 눌러 여행 일정을 확인해 보세요",
      hiddenSchedules: (count: number) => `+${count}개 더`
    },
    archiveSection: {
      title: "지난 여행",
      description: "완료된 여행 일정이에요."
    },
    preferenceSection: {
      title: "내 여행 스타일",
      description: "자주 선택한 여행 스타일을 모아두었어요"
    },
    accountSection: {
      title: "계정",
      email: "이메일:",
      provider: "로그인 방식:"
    },
    settingsSection: {
      title: "기본 설정",
      language: "언어",
      korean: "한국어",
      english: "English",
      notifications: "알림",
      notificationsToggle: "일정 알림 받기"
    },
    preferenceBadges: {
      companions: {
        SOLO: "혼자 가볍게",
        FRIENDS: "친구랑 신나게",
        COUPLE: "연인과 로맨틱하게",
        FAMILY: "가족과 추억쌓기",
        GROUP: "단체로 북적이게"
      },
      pace: {
        INTENSE: "빽빽하게",
        RELAXED: "여유롭게",
        MODERATE: "적당하게"
      },
      themes: {
        FOODIE: "먹방",
        LANDMARK: "랜드마크",
        SHOPPING: "쇼핑",
        NATURE: "자연"
      }
    },
    logout: {
      success: "로그아웃했어요",
      error: "로그아웃 중 오류가 발생했어요",
      action: "로그아웃",
      loading: "로그아웃 중"
    },
    deleteAccount: {
      action: "회원 탈퇴",
      title: "회원 탈퇴를 진행할까요?",
      success: "회원 탈퇴가 완료됐어요",
      error: "회원 탈퇴에 실패했어요",
      cancel: "취소",
      confirm: "회원 탈퇴",
      confirming: "탈퇴 처리 중",
      description: "저장 리스트, 여행 일정, 메모가 삭제되고 다시 되돌릴 수 없어요",
      emailPrompt: "탈퇴하려면 가입한 이메일을 입력해 주세요",
      emailMismatch: "가입한 이메일과 일치하지 않아요"
    }
  },

  // Top-level system pages shown outside normal page flows.
  systemPages: {
    globalError: {
      eyebrow: "ERROR",
      title: "문제가 발생했어요",
      description: "잠시 후 다시 시도해 주세요",
      action: "다시 시도"
    },
    notFound: {
      eyebrow: "404 NOT FOUND",
      title: "페이지를 찾을 수 없어요",
      description: "주소가 잘못되었거나 삭제된 페이지예요",
      action: "홈으로 이동"
    }
  }
} as const;
