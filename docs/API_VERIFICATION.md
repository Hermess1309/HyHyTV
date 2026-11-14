# NguonC contract verification

Verified live on 2026-11-14 (Asia/Bangkok). Base URL: `https://phim.nguonc.com/api/`.
Documentation: https://phim.nguonc.com/api-document

| Request | Observed response |
| --- | --- |
| `films/phim-moi-cap-nhat?page=1` | success; items; paginate.current_page/total_page/total_items/items_per_page |
| `films/danh-sach/phim-bo?page=1` | success; 10 items |
| `films/danh-sach/phim-le?page=1` | success; 10 items |
| `films/the-loai/hoat-hinh?page=1` | success; 10 items |
| `films/the-loai/hanh-dong?page=1` | success; 10 items |
| `films/the-loai/kinh-di?page=1` | success; 10 items |
| `films/the-loai/tinh-cam?page=1` | success; 10 items |
| `films/quoc-gia/viet-nam?page=1` | success |
| `films/quoc-gia/trung-quoc?page=1` | success; 10 items |
| `films/quoc-gia/han-quoc?page=1` | success; 10 items |
| `films/search?keyword=hoa&page=1` | success; items and pagination |
| `film/hoa-thien-cot` | success; movie.category map; 2 episode servers |
| `film/lang-nghe-thanh-am`, `film/loi-noi-doi-hoan-hao-2026`, `film/hoi-qua-den` | success; real episode servers |

`films/quoc-gia/au-my` returned an error and is intentionally excluded.

The current list/detail contract uses `thumb_url` for the catalog artwork, `poster_url` for backdrop artwork, `original_name`, `description`, `current_episode`, `time`, `director`, `casts`. Year can be a number in detail and a string in list responses; Gson converts both to a string. Category is an object keyed by arbitrary IDs, containing `group.name` and `list[].name`. IDs are not assumed to be URL slugs.

Episode shape observed: `movie.episodes[].server_name` and `.items[].{name,slug,embed}`. All four sampled movies returned only HTML embed links (`embed*.streamc.xyz/embed.php?hash=…`). No direct HLS/MP4 URL or external subtitle list was present. The app does not invent `m3u8` fields, scrape/decrypt embeds, bypass DRM, load a WebView, or claim these links play in ExoPlayer. It presents an explicit unavailable-source state and permits an owned HTTPS video URL to be saved per episode. A direct media URL supplied in the verified `embed` field would be usable only if its path is a supported media extension.

A single public embed URL was also checked for an openly declared direct stream. It returned a Cloudflare access block. No attempt was made to work around that access restriction. A provider-authorized native playback URL is required to play those episodes directly.

Media3 supports HLS/MP4/DASH/WebM from user-provided HTTPS URLs, in-stream subtitle selection and adaptive video tracks when the source exposes them. Embedded/burned-in subtitles cannot be toggled. Test media belongs only to instrumentation tests; it never replaces a NguonC episode in production data.

Real catalog, detail, and search response snapshots are stored under `app/src/test/resources`. They are contract fixtures, not an offline/fake runtime catalog. Unsuccessful requests surface a retry state.
