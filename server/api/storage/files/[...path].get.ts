import { defineEventHandler } from 'h3';
import { serveStorageFile } from '~/server/utils/storageServe';

export default defineEventHandler((event) => serveStorageFile(event));
