import { z } from "zod";
import { idQuery, pageNumber, pageSize } from "./common.validators.js";

const getNotificationsSchema = z.object({
  query: z.object({
    pageSize: pageSize(),
    pageNumber: pageNumber(),
  }),
});

export { getNotificationsSchema };
