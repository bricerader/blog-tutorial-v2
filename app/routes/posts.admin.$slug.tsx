import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  useActionData,
  useRouteError,
  useLoaderData,
  useNavigation,
  isRouteErrorResponse,
} from "@remix-run/react";
import { createPost, deletePost, getPost, updatePost } from "~/models/post.server";
import invariant from "tiny-invariant";
import { requireAdminUser } from "~/session.server";
import { Post } from "@prisma/client";

const inputClassName = `w-full rounded border border-gray-500 px-2 py-1 text-lg`;

type LoaderData = { post?: Post } // is this deprecated or better way to do in v2?

export const action = async ({ params, request }: ActionArgs)=> {
  await requireAdminUser(request);
  invariant(params.slug, `params.slug.is required`);
  // TODO: remove me
  await new Promise((res) => setTimeout(res, 1000));

  const formData = await request.formData();
  const intent = formData.get('intent')

  if (intent === 'delete') {
    await deletePost(params.slug);
    return redirect('/posts/admin');
  }

  const title = formData.get("title");
  const slug = formData.get("slug");
  const markdown = formData.get("markdown");

  const errors = {
    title: title ? null : "Title is required",
    slug: slug ? null : "Slug is required",
    markdown: markdown ? null : "Markdown is required",
  };
  const hasErrors = Object.values(errors)
    .some((errorMessage) => errorMessage);
  if (hasErrors) {
    return json(errors);
  }

  invariant(
    typeof title === "string",
    "title must be a string"
  );
  invariant(
    typeof slug === "string",
    "slug must be a string"
  );
  invariant(
    typeof markdown === "string",
    "markdown must be a string"
  );

  if (params.slug === 'new') {
    await createPost({ title, slug, markdown })
  } else {
    await updatePost(params?.slug ?? slug, { title, slug, markdown });
  }

  return redirect("/posts/admin")
}

export const loader = async ({ params, request }: LoaderArgs) => {
  await requireAdminUser(request);
  invariant(params.slug, `params.slug.is required`);
  if (params.slug === 'new') {
    return json<LoaderData>({});
  }

  const post = await getPost(params.slug);
  if (!post) {
    const statusText =
      `Uh oh! the post with the slug "${params.slug}" is not found`;
    throw new Response('Not Found', { status: 404, statusText })
  }

  // const html = marked(post.markdown);
 return json<LoaderData>({ post });
}

export default function PostSlug() {
  const { post } = useLoaderData<typeof loader>();
  const errors = useActionData<typeof action>();

  const navigation = useNavigation();
  // const isCreating = Boolean(navigation.state === "submitting");
  const isCreating = navigation.formData?.get('intent') === 'create'
  const isUpdating = navigation.formData?.get('intent') === 'update'
  const isDeleting = navigation.formData?.get('intent') === 'delete'
  const isNewPost = !post;

  return (
    <Form method="post" key={post?.slug ?? 'new'}>
      <p>
        <label>
          Post Title:{" "}
          {errors?.title ? (
            <em className="text-red-600">{errors.title}</em>
          ) : null}
          <input
            type="text"
            name="title"
            className={inputClassName}
            defaultValue={post?.title}
          />
        </label>
      </p>
      <p>
        <label>
          Post Slug:{" "}
          {errors?.slug ? (
            <em className="text-red-600">{errors.slug}</em>
          ) : null}
          <input
            type="text"
            name="slug"
            className={inputClassName}
            defaultValue={post?.slug}
          />
        </label>
      </p>
      <p>
        <label htmlFor="markdown">
          Markdown:{" "}
          {errors?.markdown ? (
            <em className="text-red-600">{errors.markdown}</em>
          ) : null}
        </label>
        <br />
        <textarea
          id="markdown"
          rows={20}
          name="markdown"
          className={`${inputClassName} font-mono`}
          defaultValue={post?.markdown}

        />
      </p>
      <div className="flex justify-end gap-4">
        {isNewPost ? null :
          <button
            type="submit"
            name="intent"
            value="delete"
            className="rounded bg-red-500 py-2 px-4 text-white hover:bg-blue-600 focus:bg-blue-400 disabled:bg-blue-300"
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Post"}
          </button>
        }
        <button
          type="submit"
          name="intent"
          value={isNewPost ? 'create' : 'update'}
          className="rounded bg-blue-500 py-2 px-4 text-white hover:bg-blue-600 focus:bg-blue-400 disabled:bg-blue-300"
          disabled={isCreating || isUpdating}
        >
          {isNewPost ? (isCreating ? "Creating..." : "Create Post") : null}
          {isNewPost ? null : isUpdating ? "Updating..." : "Update Post"}
        </button>
      </div>
    </Form>
  );
  // const { html = 'test', post } = useLoaderData<typeof loader>();
  //
  // const navigation = useNavigation();
  // const isEditing = Boolean(navigation.state === "submitting");
  //
  // return (
  //   <main className="mx-auto max-w-4xl">
  //     <h1 className="my-6 border-b-2 text-center text-3xl">
  //       {post?.title}
  //     </h1>
  //     <div dangerouslySetInnerHTML={{ __html: html  }} />
  //     <button
  //       type="submit"
  //       className="rounded bg-blue-500 py-2 px-4 text-white hover:bg-blue-600 focus:bg-blue-400 disabled:bg-blue-300"
  //       disabled={isEditing}
  //     >
  //       {isEditing ? "Editing..." : "Edit Post"}
  //     </button>
  //   </main>
  // );
}

export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return (
      // <div>Uh oh! the post with the slug "{params.slug}" is {error.status}!</div>
      <div>
        <h1>Oops</h1>
        <p>Status: {error.status}</p>
        <p>{error.statusText}</p>
      </div>
    );
  }

  function isDefinitelyAnError(error: any): error is Error {
    return error instanceof Error;
  }

  let errorMessage = "Unknown error";
  if (isDefinitelyAnError(error)) {
    errorMessage = error.message;
  }

  return (
    <div>
      <h1>Uh oh ...</h1>
      <p>Something went wrong.</p>
      <pre>{errorMessage}</pre>
    </div>
  )
}
