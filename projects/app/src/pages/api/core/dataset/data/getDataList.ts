import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@/service/response';
import { connectToDatabase } from '@/service/mongo';
import { authUser } from '@fastgpt/support/user/auth';
import { PgClient } from '@/service/pg';
import { PgDatasetTableName } from '@/constants/plugin';
import type { PgDataItemType } from '@/types/core/dataset/data';

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    await connectToDatabase();
    let {
      kbId,
      pageNum = 1,
      pageSize = 10,
      searchText = '',
      fileId = ''
    } = req.body as {
      kbId: string;
      pageNum: number;
      pageSize: number;
      searchText: string;
      fileId: string;
    };
    if (!kbId) {
      throw new Error('缺少参数');
    }

    // 凭证校验
    const { userId } = await authUser({ req, authToken: true });

    searchText = searchText.replace(/'/g, '');

    const where: any = [
      ['user_id', userId],
      'AND',
      ['kb_id', kbId],
      'AND',
      ['file_id', fileId],
      ...(searchText
        ? [
            'AND',
            `(q ILIKE '%${searchText}%' OR a ILIKE '%${searchText}%' OR source ILIKE '%${searchText}%')`
          ]
        : [])
    ];

    const [searchRes, total] = await Promise.all([
      PgClient.select<PgDataItemType>(PgDatasetTableName, {
        fields: ['id', 'q', 'a', 'source', 'file_id'],
        where,
        order: [{ field: 'id', mode: 'DESC' }],
        limit: pageSize,
        offset: pageSize * (pageNum - 1)
      }),
      PgClient.count(PgDatasetTableName, {
        fields: ['id'],
        where
      })
    ]);

    jsonRes(res, {
      data: {
        pageNum,
        pageSize,
        data: searchRes.rows,
        total
      }
    });
  } catch (err) {
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
}
