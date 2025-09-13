import { NextResponse } from "next/server"
import { fetchDataWithCache, fetchDoodApiResults, calculateRelevance } from "@/app/lib/fetchData"
import { setCorsHeaders } from "@/app/lib/cors"
import { processTitle } from "@/app/lib/titleProcessor"
import { validateSearchQuery, validatePagination, validateUrl } from "@/app/lib/validation"
import { getVercelCacheHeaders } from "@/app/lib/cacheManager"

export const runtime = "edge"

export const revalidate = 7200 // 2 hours (2 * 60 * 60) for search results

export async function GET(request: Request) {
  if (!validateUrl(request.url)) {
    const errorResponse = NextResponse.json({ error: "Invalid request" }, { status: 400 })
    return setCorsHeaders(errorResponse)
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")
  // Set default page and per_page values if they are not provided
  const page = searchParams.get("page") || "1"
  const perPage = searchParams.get("per_page") || "100"

  const queryValidation = validateSearchQuery(query || "")
  if (!queryValidation.isValid) {
    const errorResponse = NextResponse.json({ error: queryValidation.error }, { status: 400 })
    return setCorsHeaders(errorResponse)
  }

  const paginationValidation = validatePagination(page, perPage)
  if (!paginationValidation.isValid) {
    const errorResponse = NextResponse.json({ error: paginationValidation.error }, { status: 400 })
    return setCorsHeaders(errorResponse)
  }

  const sanitizedQuery = queryValidation.sanitized!
  const { page: pageNum, perPage: perPageNum } = paginationValidation.sanitized!

  try {
    const [localData, doodApiResults] = await Promise.all([fetchDataWithCache(), fetchDoodApiResults(sanitizedQuery)])

    // Memisahkan query menjadi array kata-kata
    const keywords = sanitizedQuery.toLowerCase().split(/\s+/).filter(Boolean)

    const seenFileCodes = new Set<string>()

    const luluStreamResults = localData
      .filter((file: any) => {
        const titleLower = file.title.toLowerCase()
        // Mencocokkan judul dengan salah satu kata kunci dari query
        return keywords.some((keyword) => titleLower.includes(keyword))
      })
      .map((file: any) => {
        seenFileCodes.add(file.file_code)

        const relevanceScore = calculateRelevance(file.title, keywords, sanitizedQuery)

        return {
          single_img: file.single_img,
          length: file.length.toString(),
          views: file.views.toString(),
          title: processTitle(file.title),
          file_code: file.file_code,
          uploaded: file.uploaded,
          splash_img: file.splash_img,
          canplay: file.canplay ? 1 : 0,
          api_source: "lulustream",
          _relevance: relevanceScore,
        }
      })

    const doodStreamResults = doodApiResults
      .filter((file: any) => !seenFileCodes.has(file.file_code))
      .map((file: any) => {
        seenFileCodes.add(file.file_code)

        const relevanceScore = calculateRelevance(file.title, keywords, sanitizedQuery)

        return {
          single_img: file.single_img,
          length: file.length.toString(),
          views: file.views.toString(),
          title: processTitle(file.title),
          file_code: file.file_code,
          uploaded: file.uploaded,
          splash_img: file.splash_img,
          canplay: file.canplay ? 1 : 0,
          api_source: file.api_source,
          _relevance: relevanceScore,
        }
      })

    const allResults = [...luluStreamResults, ...doodStreamResults]
      .sort((a: any, b: any) => {
        if (b._relevance !== a._relevance) {
          return b._relevance - a._relevance
        }
        return Number.parseInt(b.views) - Number.parseInt(a.views)
      })
      .map(({ _relevance, ...result }: any) => result)

    if (allResults.length === 0) {
      const notFoundResponse = NextResponse.json({ error: "No results found" }, { status: 404 })
      return setCorsHeaders(notFoundResponse)
    }

    const startIndex = (pageNum - 1) * perPageNum
    const endIndex = startIndex + perPageNum
    const paginatedResults = allResults.slice(startIndex, endIndex)

    if (paginatedResults.length === 0) {
      const notFoundResponse = NextResponse.json({ error: "No results found for this page" }, { status: 404 })
      return setCorsHeaders(notFoundResponse)
    }

    const result = {
      server_time: new Date().toISOString().replace("T", " ").substr(0, 19),
      status: 200,
      msg: "OK",
      result: paginatedResults,
      total_results: allResults.length,
      page: pageNum,
      per_page: perPageNum,
      total_pages: Math.ceil(allResults.length / perPageNum),
    }

    const response = NextResponse.json(result)

    const cacheHeaders = getVercelCacheHeaders(7200) // 2 hours for search results
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
