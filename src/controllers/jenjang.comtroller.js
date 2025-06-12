import { prisma } from "../prisma.js";

export class JenjangComtroller {

    static async getAllJenjang(req, res, next) {
        try {
            const jenjangs = await prisma.ref_jenjang.findMany();
            res.status(200).json(jenjangs);
        } catch (error) {
            next(error);
        }
    }

}