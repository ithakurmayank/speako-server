const getOffsetPaginationValues = (query = {}) => {
  let { pageNumber = 1, pageSize = 20 } = query;

  const parsedPage = Math.max(1, parseInt(pageNumber) || 1);
  const parsedSize = Math.min(100, Math.max(1, parseInt(pageSize) || 10));

  const skip = (parsedPage - 1) * parsedSize;

  return {
    page: parsedPage,
    size: parsedSize,
    skip,
    limit: parsedSize,
  };
};

export const getPaginatedResponse = ({
  items,
  totalCount,
  pageNumber,
  pageSize,
}) => {
  const totalPages = pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0;

  return {
    items,
    totalCount,
    pageNumber,
    pageSize,
    totalPages,
    hasNextPage: pageNumber < totalPages,
    hasPreviousPage: pageNumber > 1,
  };
};

export { getOffsetPaginationValues, getPaginatedResponse };
