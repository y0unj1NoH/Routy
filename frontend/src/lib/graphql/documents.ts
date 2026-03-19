export const PLACE_FIELDS = /* GraphQL */ `
  id
  googlePlaceId
  name
  formattedAddress
  lat
  lng
  rating
  userRatingCount
  priceLevel
  typesRaw
  primaryType
  primaryTypeDisplayName
  categories
  googleMapsUrl
  openingHours
  photos
  reviews
  phone
  website
  createdAt
  updatedAt
`;

export const PLACE_PREVIEW_FIELDS = /* GraphQL */ `
  id
  name
  photos
`;

export const PLACE_LIST_CARD_FIELDS = /* GraphQL */ `
  id
  userId
  name
  city
  language
  description
  itemCount
  createdAt
  updatedAt
`;

export const PLACE_LIST_DETAIL_FIELDS = /* GraphQL */ `
  ${PLACE_LIST_CARD_FIELDS}
  items {
    id
    note
    isMustVisit
    createdAt
    place {
      ${PLACE_FIELDS}
    }
  }
`;

export const MY_PLACE_LISTS_QUERY = /* GraphQL */ `
  query MyPlaceLists($limit: Int, $offset: Int) {
    myPlaceLists(limit: $limit, offset: $offset) {
      ${PLACE_LIST_CARD_FIELDS}
      previewPlaces(limit: 4) {
        ${PLACE_PREVIEW_FIELDS}
      }
    }
  }
`;

export const PLACE_LIST_DETAIL_QUERY = /* GraphQL */ `
  query PlaceListDetail($id: ID!) {
    placeList(id: $id) {
      ${PLACE_LIST_DETAIL_FIELDS}
    }
  }
`;

export const PLACE_DETAIL_QUERY = /* GraphQL */ `
  query PlaceDetail($id: ID!) {
    place(id: $id) {
      ${PLACE_FIELDS}
    }
  }
`;

export const MY_SCHEDULES_QUERY = /* GraphQL */ `
  query MySchedules($limit: Int, $offset: Int) {
    mySchedules(limit: $limit, offset: $offset) {
      id
      userId
      title
      startDate
      endDate
      dayCount
      companions
      pace
      themes
      isManualModified
      createdAt
      updatedAt
      placeList {
        ${PLACE_LIST_CARD_FIELDS}
      }
    }
  }
`;

export const SCHEDULE_DETAIL_QUERY = /* GraphQL */ `
  query ScheduleDetail($id: ID!) {
    schedule(id: $id) {
      id
      userId
      title
      startDate
      endDate
      dayCount
      companions
      pace
      themes
      outputLanguage
      generationInput
      generationVersion
      isManualModified
      createdAt
      updatedAt
      placeList {
        ${PLACE_LIST_CARD_FIELDS}
      }
    stayPlace {
      ${PLACE_FIELDS}
    }
    stayRecommendation
    days {
        id
        dayNumber
        date
        stops {
          id
          stopOrder
          time
          label
          isMustVisit
          note
          visitTip
          transportToNext
          isUserModified
          place {
            ${PLACE_FIELDS}
          }
        }
      }
    }
  }
`;

export const UPDATE_PLACE_LIST_MUTATION = /* GraphQL */ `
  mutation UpdatePlaceList($id: ID!, $input: UpdatePlaceListInput!) {
    updatePlaceList(id: $id, input: $input) {
      ${PLACE_LIST_DETAIL_FIELDS}
    }
  }
`;

export const UPDATE_PLACE_LIST_ITEM_MUTATION = /* GraphQL */ `
  mutation UpdatePlaceListItem($id: ID!, $input: UpdatePlaceListItemInput!) {
    updatePlaceListItem(id: $id, input: $input) {
      id
      note
      isMustVisit
      createdAt
    }
  }
`;

export const REMOVE_PLACE_LIST_ITEM_MUTATION = /* GraphQL */ `
  mutation RemovePlaceListItem($id: ID!) {
    removePlaceListItem(id: $id)
  }
`;

export const ADD_PLACE_LIST_ITEM_MUTATION = /* GraphQL */ `
  mutation AddPlaceListItem($input: AddPlaceListItemInput!) {
    addPlaceListItem(input: $input) {
      id
    }
  }
`;

export const DELETE_PLACE_LIST_MUTATION = /* GraphQL */ `
  mutation DeletePlaceList($id: ID!) {
    deletePlaceList(id: $id)
  }
`;

export const IMPORT_PLACE_LIST_FROM_CRAWLER_MUTATION = /* GraphQL */ `
  mutation ImportPlaceListFromCrawler($url: String!, $listName: String!, $city: String!) {
    importPlaceListFromCrawler(url: $url, listName: $listName, city: $city) {
      ${PLACE_LIST_CARD_FIELDS}
    }
  }
`;

export const IMPORT_PLACE_FROM_GOOGLE_LINK_MUTATION = /* GraphQL */ `
  mutation ImportPlaceFromGoogleLink($url: String!) {
    importPlaceFromGoogleLink(url: $url) {
      ${PLACE_FIELDS}
    }
  }
`;

export const DELETE_MY_ACCOUNT_MUTATION = /* GraphQL */ `
  mutation DeleteMyAccount {
    deleteMyAccount
  }
`;

export const CREATE_SCHEDULE_MUTATION = /* GraphQL */ `
  mutation CreateSchedule($input: CreateScheduleInput!) {
    createSchedule(input: $input) {
      id
      title
      startDate
      endDate
      dayCount
      createdAt
      updatedAt
    }
  }
`;

export const MOVE_SCHEDULE_STOP_MUTATION = /* GraphQL */ `
  mutation MoveScheduleStop($scheduleId: ID!, $input: MoveScheduleStopInput!) {
    moveScheduleStop(scheduleId: $scheduleId, input: $input) {
      id
      isManualModified
      updatedAt
    }
  }
`;

export const UPDATE_SCHEDULE_STOP_MUTATION = /* GraphQL */ `
  mutation UpdateScheduleStop($scheduleId: ID!, $input: UpdateScheduleStopInput!) {
    updateScheduleStop(scheduleId: $scheduleId, input: $input) {
      id
      note
      isUserModified
    }
  }
`;

export const REGENERATE_SCHEDULE_MUTATION = /* GraphQL */ `
  mutation RegenerateSchedule($scheduleId: ID!, $input: RegenerateScheduleInput!) {
    regenerateSchedule(scheduleId: $scheduleId, input: $input) {
      id
      updatedAt
      isManualModified
    }
  }
`;

export const DELETE_SCHEDULE_MUTATION = /* GraphQL */ `
  mutation DeleteSchedule($id: ID!) {
    deleteSchedule(id: $id)
  }
`;
