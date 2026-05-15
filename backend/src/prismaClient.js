import pkg from '@prisma/client';
const { PrismaClient } = pkg;

// PrismaClient peut être importé et instancié une seule fois
const prisma = new PrismaClient();
export default prisma;
