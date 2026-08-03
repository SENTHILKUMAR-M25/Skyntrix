import Team from "../models/Team.model.js";
import createCrudController from "./crud.factory.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/response.js";
import ApiError from "../utils/ApiError.js";
import { uploadFile, deleteFile } from "../services/cloudinary.service.js";

const base = createCrudController(Team, {
  searchFields: ["name", "position", "bio"],
  defaultSort: { displayOrder: 1, createdAt: -1 },
  documentName: "Team",
  publicFilter: { isActive: true },
});

const withPhoto = async (req, body) => {
  if (req.file) {
    const img = await uploadFile(req.file, { folder: "skyntrix/team" });
    body.photo = img.url;
    body.photoPublicId = img.public_id;
  }
  return body;
};

export const createTeam = asyncHandler(async (req, res) => {
  const body = await withPhoto(req, req.body);
  const doc = await Team.create(body);
  return ApiResponse.created(res, "Team member created", doc);
});

export const updateTeam = asyncHandler(async (req, res) => {
  const existing = await Team.findById(req.params.id);
  if (!existing) throw ApiError.notFound("Team member not found");
  const body = await withPhoto(req, req.body);
  if (req.file && existing.photoPublicId) await deleteFile(existing.photoPublicId);
  existing.set(body);
  await existing.save();
  return ApiResponse.ok(res, "Team member updated", existing);
});

export const deleteTeam = asyncHandler(async (req, res) => {
  const existing = await Team.findById(req.params.id);
  if (!existing) throw ApiError.notFound("Team member not found");
  if (existing.photoPublicId) await deleteFile(existing.photoPublicId);
  await existing.deleteOne();
  return ApiResponse.ok(res, "Team member deleted");
});

export const fetchPublicTeam = base.listPublic;
export const listTeam = base.list;
export const listTeamDetail = base.detail;