import { NextResponse } from "next/server"
import { fetchDataWithCache, fetchDoodApiList } from "@/app/lib/fetchData"
import { setCorsHeaders } from "@/app/lib/cors"
import { processTitle } from "@/app/lib/titleProcessor"
import { validatePagination } from "@/app/lib/validation"
import { getVercelCacheHeaders } from "@/app/lib/cacheManager"

export const runtime = "edge"

export const revalidate = 86400 // 24 hours (reduced from 7 days for better freshness)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = searchParams.get("page")
  const perPage = searchParams.get("per_page")

  const validation = validatePagination(page, perPage)
  if (!validation.isValid) {
    const errorResponse = NextResponse.json({ error: validation.error }, { status: 400 })
    return setCorsHeaders(errorResponse)
  }

  const { page: pageNum, perPage: perPageNum } = validation.sanitized!

  try {
    const [localData, doodData] = await Promise.all([fetchDataWithCache(), fetchDoodApiList(pageNum, perPageNum)])

    const startIndex = (pageNum - 1) * perPageNum
    const endIndex = startIndex + perPageNum
    const paginatedLocalFiles = localData.slice(startIndex, endIndex)

    const luluStreamFiles = paginatedLocalFiles.map((file) => ({
      public: "1",
      single_img: file.single_img,
      canplay: file.canplay ? 1 : 0,
      uploaded: file.uploaded,
      views: file.views.toString(),
      length: file.length,
      download_url: file.protected_dl,
      file_code: file.file_code,
      title: processTitle(file.title),
      fld_id: "0",
      splash_img: file.splash_img,
      api_source: "lulustream",
    }))

    let doodStreamFiles: any[] = []
    if (doodData && doodData.result && doodData.result.files) {
      doodStreamFiles = doodData.result.files.map((file: any) => ({
        public: file.public,
        single_img: file.single_img,
        canplay: file.canplay,
        uploaded: file.uploaded,
        views: file.views.toString(),
        length: file.length,
        download_url: file.download_url,
        file_code: file.file_code,
        title: processTitle(file.title),
        fld_id: file.fld_id,
        splash_img: file.splash_img,
        api_source: "doodstream",
      }))
    }

    const combinedFiles = [...luluStreamFiles, ...doodStreamFiles]

    if (combinedFiles.length === 0) {
      const notFoundResponse = NextResponse.json({ error: "No data available" }, { status: 404 })
      return setCorsHeaders(notFoundResponse)
    }

    const totalResults =
      localData.length + (doodData?.result?.results_total ? Number.parseInt(doodData.result.results_total) : 0)
    const totalPages = Math.ceil(totalResults / perPageNum)

    const result = {
      result: {
        total_pages: totalPages,
        results_total: totalResults.toString(),
        results: combinedFiles.length,
        files: combinedFiles,
        per_page_limit: perPageNum.toString(),
      },
      status: 200,
      msg: "OK",
      server_time: new Date().toISOString().replace("T", " ").substr(0, 19),
    }

    const response = NextResponse.json(result)

    const cacheHeaders = getVercelCacheHeaders(86400) // 24 hours
    Object.entries(cacheHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return setCorsHeaders(response)
  } catch (error) {
    const errorResponse = NextResponse.json({ error: "Failed to fetch data" }, { status: 500 })
    return setCorsHeaders(errorResponse)
  }
}

export async function OPTIONS() {
  return setCorsHeaders(new NextResponse(null, { status: 200 }))
}
