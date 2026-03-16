const typeDefs = /* GraphQL */ `
  scalar JSON

  type HealthCheck {
    status: String!
    timestamp: String!
  }

  type User {
    id: ID!
    email: String
  }

  type AuthPayload {
    accessToken: String
    refreshToken: String
    expiresAt: Int
    tokenType: String
    user: User
  }

  type ParsedGoogleLink {
    kind: String!
    placeIds: [String!]!
    note: String
    query: String
  }

  type Place {
    id: ID!
    googlePlaceId: String!
    name: String
    formattedAddress: String
    lat: Float
    lng: Float
    rating: Float
    userRatingCount: Int
    priceLevel: Int
    typesRaw: JSON
    category: String
    googleMapsUrl: String
    openingHours: JSON
    photos: JSON
    reviews: JSON
    phone: String
    website: String
    createdAt: String!
    updatedAt: String!
  }

  type PlaceListItem {
    id: ID!
    note: String
    isMustVisit: Boolean!
    createdAt: String!
    place: Place!
  }

  type PlaceList {
    id: ID!
    userId: ID!
    name: String!
    city: String!
    language: String!
    description: String
    itemCount: Int!
    items: [PlaceListItem!]!
    previewPlaces(limit: Int = 4): [Place!]!
    createdAt: String!
    updatedAt: String!
  }

  type ScheduleStop {
    id: ID!
    stopOrder: Int!
    time: String
    label: String
    isMustVisit: Boolean!
    note: String
    reason: String
    visitTip: String
    transportToNext: JSON
    isUserModified: Boolean!
    place: Place!
  }

  type ScheduleDay {
    id: ID!
    dayNumber: Int!
    date: String
    stops: [ScheduleStop!]!
  }

  type Schedule {
    id: ID!
    userId: ID!
    title: String!
    startDate: String!
    endDate: String!
    dayCount: Int!
    placeList: PlaceList!
    stayPlace: Place
    stayRecommendation: JSON
    companions: String
    pace: String
    themes: [String!]!
    outputLanguage: String!
    generationInput: JSON
    generationVersion: String
    isManualModified: Boolean!
    days: [ScheduleDay!]!
    createdAt: String!
    updatedAt: String!
  }

  input PlaceUpsertInput {
    googlePlaceId: String!
    name: String
    formattedAddress: String
    lat: Float
    lng: Float
    rating: Float
    userRatingCount: Int
    priceLevel: Int
    typesRaw: JSON
    category: String
    googleMapsUrl: String
    openingHours: JSON
    photos: JSON
    reviews: JSON
    phone: String
    website: String
  }

  input CreatePlaceListInput {
    name: String!
    city: String!
    language: String
    description: String
  }

  input UpdatePlaceListInput {
    name: String
    city: String
    language: String
    description: String
  }

  input AddPlaceListItemInput {
    listId: ID!
    placeId: ID!
    note: String
    isMustVisit: Boolean = false
  }

  input UpdatePlaceListItemInput {
    note: String
    isMustVisit: Boolean
  }

  input CreateScheduleInput {
    title: String!
    startDate: String!
    endDate: String!
    placeListId: ID!
    stayPlaceId: ID
    companions: String
    pace: String
    themes: [String!] = []
    outputLanguage: String
  }

  input RegenerateScheduleInput {
    startDate: String
    endDate: String
    placeListId: ID
    stayPlaceId: ID
    companions: String
    pace: String
    themes: [String!]
    outputLanguage: String
  }

  input MoveScheduleStopInput {
    stopId: ID!
    targetDayNumber: Int!
    targetOrder: Int!
  }

  input UpdateScheduleStopInput {
    stopId: ID!
    note: String
  }

  type Query {
    health: HealthCheck!
    me: User
    parseGoogleMapsLink(url: String!): ParsedGoogleLink!
    places(limit: Int = 100, offset: Int = 0): [Place!]!
    place(id: ID!): Place
    placeByGooglePlaceId(googlePlaceId: String!): Place
    myPlaceLists(limit: Int = 50, offset: Int = 0): [PlaceList!]!
    placeList(id: ID!): PlaceList
    mySchedules(limit: Int = 20, offset: Int = 0): [Schedule!]!
    schedule(id: ID!): Schedule
  }

  type Mutation {
    signUp(email: String!, password: String!): AuthPayload!
    signIn(email: String!, password: String!): AuthPayload!
    signInWithGoogle(redirectTo: String): String!
    deleteMyAccount: Boolean!

    importPlaceListFromCrawler(url: String!, listName: String!, city: String!, description: String, language: String): PlaceList!
    importPlaceFromGoogleLink(url: String!): [Place!]!
    upsertPlace(input: PlaceUpsertInput!): Place!
    refreshPlaceDetails(id: ID!): Place!

    createPlaceList(input: CreatePlaceListInput!): PlaceList!
    updatePlaceList(id: ID!, input: UpdatePlaceListInput!): PlaceList!
    deletePlaceList(id: ID!): Boolean!
    addPlaceListItem(input: AddPlaceListItemInput!): PlaceList!
    updatePlaceListItem(id: ID!, input: UpdatePlaceListItemInput!): PlaceListItem!
    removePlaceListItem(id: ID!): Boolean!

    createSchedule(input: CreateScheduleInput!): Schedule!
    regenerateSchedule(scheduleId: ID!, input: RegenerateScheduleInput!): Schedule!
    moveScheduleStop(scheduleId: ID!, input: MoveScheduleStopInput!): Schedule!
    updateScheduleStop(scheduleId: ID!, input: UpdateScheduleStopInput!): ScheduleStop!
    deleteSchedule(id: ID!): Boolean!
  }
`;

module.exports = { typeDefs };
