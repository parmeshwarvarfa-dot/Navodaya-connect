import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import newsRouter from "./news";
import groupsRouter from "./groups";
import problemsRouter from "./problems";
import eventsRouter from "./events";
import usersRouter from "./users";
import mentorRequestsRouter from "./mentorRequests";
import verificationRouter from "./verification";
import teacherFeedbackRouter from "./teacherFeedback";
import jobsRouter from "./jobs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(newsRouter);
router.use(groupsRouter);
router.use(problemsRouter);
router.use(eventsRouter);
router.use(usersRouter);
router.use(mentorRequestsRouter);
router.use(verificationRouter);
router.use(teacherFeedbackRouter);
router.use(jobsRouter);

export default router;
