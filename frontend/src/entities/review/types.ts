export type Review = {
  id: string;
  eventId: string;
  authorId: string;
  targetUserId: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
};

export type ReviewPage = {
  content: Review[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
  averageRating?: number | null;
};

export type ReviewCreate = {
  eventId: string;
  targetUserId: string;
  rating: number;
  comment?: string | null;
};
